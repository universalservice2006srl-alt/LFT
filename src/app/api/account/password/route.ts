import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { writeAudit } from "@/lib/data";
import { validatePassword } from "@/lib/password";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Self-service password change — Super Admin only.
 * Drivers and branch managers must have their password reset by the fleet
 * manager, so they are rejected here.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only the fleet manager can change their own password" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "All password fields are required" }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "New passwords do not match" }, { status: 400 });
    }

    const problem = validatePassword(newPassword);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }
    const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(user.id, {
      password: newPassword,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await db.update(profiles).set({ passwordSetAt: new Date(), passwordSetBy: user.id }).where(eq(profiles.id, user.id));

    await writeAudit({
      actorId: user.id,
      action: "account.password_changed",
      entityType: "profile",
      entityId: user.id,
      details: `${user.fullName} changed their own password`,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not change password" }, { status: 500 });
  }
}
