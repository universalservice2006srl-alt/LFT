import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { homeForRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const GENERIC = "Incorrect email or password";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return NextResponse.json({ error: GENERIC }, { status: 401 });

    const rows = await db.select().from(profiles).where(eq(profiles.id, data.user.id)).limit(1);
    const user = rows[0];
    if (!user || !user.isActive) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "This account is deactivated. Contact your fleet manager." },
        { status: 403 }
      );
    }
    await db.update(profiles).set({ lastLoginAt: new Date() }).where(eq(profiles.id, user.id));

    return NextResponse.json({
      ok: true,
      redirect: homeForRole(user.role),
      user: { fullName: user.fullName, role: user.role },
    });
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
