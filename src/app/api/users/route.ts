import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { writeAudit } from "@/lib/data";
import { generatePassword } from "@/lib/password";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUniqueViolation } from "@/lib/db-errors";

const COLORS = ["#245bc1", "#08dc7d", "#46286E", "#00b3d7", "#c2741a", "#21264e"];

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only the fleet manager (super admin) can create accounts" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = String(body.role ?? "driver");
    const branchId = body.branchId ? String(body.branchId) : null;
    const phone = body.phone ? String(body.phone).trim().slice(0, 32) : null;
    const vehicleReg = body.vehicleReg ? String(body.vehicleReg).trim().slice(0, 40) : null;
    const drivingLicenceNumber = body.drivingLicenceNumber
      ? String(body.drivingLicenceNumber).trim().slice(0, 40)
      : null;
    const drivingLicenceExpiry = body.drivingLicenceExpiry
      ? new Date(String(body.drivingLicenceExpiry))
      : null;

    if (!fullName) return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    if (!["super_admin", "branch_manager", "driver"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (role !== "super_admin" && !branchId) {
      return NextResponse.json({ error: "Branch is required for this role" }, { status: 400 });
    }
    if (drivingLicenceExpiry && Number.isNaN(drivingLicenceExpiry.getTime())) {
      return NextResponse.json({ error: "Driving licence expiry date is invalid" }, { status: 400 });
    }

    // Supabase Auth owns the password. Return a generated one only once so the
    // manager can hand it to the new user.
    let password = body.password ? String(body.password) : "";
    if (!password) password = generatePassword();

    const supabase = createSupabaseAdminClient();
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (authError || !authUser.user) {
      return NextResponse.json({ error: authError?.message ?? "Could not create auth user" }, { status: 400 });
    }

    try {
      const [inserted] = await db
        .insert(profiles)
        .values({
          id: authUser.user.id,
        fullName,
        email,
        role: role as never,
        branchId: role === "super_admin" ? null : branchId,
        phone,
        vehicleReg,
        drivingLicenceNumber,
        drivingLicenceExpiry: drivingLicenceExpiry ?? null,
        avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
        passwordSetBy: user.id,
        isActive: true,
        })
        .returning();

      await writeAudit({
      actorId: user.id,
      action: "user.created",
      entityType: "profile",
      entityId: inserted.id,
      branchId: inserted.branchId,
      details: `Created ${role.replace("_", " ")} · ${fullName} (${email})`,
    });

      return NextResponse.json({
      ok: true,
      id: inserted.id,
      email: inserted.email,
      fullName: inserted.fullName,
      password,
      });
    } catch (error) {
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw error;
    }
  } catch (e: unknown) {
    const msg = isUniqueViolation(e)
      ? "A user with this email already exists"
      : "Could not create user";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
