import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { mileageLogs, profiles, vehicles } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { writeAudit } from "@/lib/data";
import { generatePassword, hashPassword, validatePassword } from "@/lib/password";
import { isUniqueViolation } from "@/lib/db-errors";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "super_admin") {
    return {
      error: NextResponse.json(
        { error: "Only the fleet manager (super admin) can manage accounts" },
        { status: 403 }
      ),
    };
  }
  return { user };
}

async function countOtherActiveAdmins(excludeId: string) {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(profiles)
    .where(
      and(eq(profiles.role, "super_admin"), eq(profiles.isActive, true), ne(profiles.id, excludeId))
    );
  return rows[0]?.n ?? 0;
}

/* ------------------------------------------------------------------ */
/* PATCH — edit profile, set/reset password, activate / deactivate     */
/* ------------------------------------------------------------------ */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const admin = guard.user!;
  const { id } = await params;

  const rows = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
  const target = rows[0];
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json();
  const action = String(body.action ?? "update");

  /* ---------------- password actions ---------------- */
  if (action === "reset_password" || action === "set_password") {
    let password: string;
    if (action === "set_password") {
      password = String(body.password ?? "");
      const problem = validatePassword(password);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    } else {
      password = generatePassword();
    }

    await db
      .update(profiles)
      .set({
        passwordHash: hashPassword(password),
        passwordPlain: password,
        passwordSetAt: new Date(),
        passwordSetBy: admin.id,
        failedAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(profiles.id, id));

    await writeAudit({
      actorId: admin.id,
      action: "user.password_reset",
      entityType: "profile",
      entityId: id,
      branchId: target.branchId,
      details: `${action === "reset_password" ? "Generated new" : "Set"} password for ${target.fullName}`,
    });

    return NextResponse.json({ ok: true, password });
  }

  /* ---------------- activation ---------------- */
  if (action === "set_active") {
    const isActive = Boolean(body.isActive);
    if (!isActive) {
      if (target.id === admin.id) {
        return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
      }
      if (target.role === "super_admin" && (await countOtherActiveAdmins(target.id)) === 0) {
        return NextResponse.json(
          { error: "At least one active fleet manager must remain" },
          { status: 400 }
        );
      }
    }
    await db
      .update(profiles)
      .set({ isActive, failedAttempts: 0, lockedUntil: null })
      .where(eq(profiles.id, id));

    await writeAudit({
      actorId: admin.id,
      action: isActive ? "user.activated" : "user.deactivated",
      entityType: "profile",
      entityId: id,
      branchId: target.branchId,
      details: `${isActive ? "Activated" : "Deactivated"} ${target.fullName}`,
    });
    return NextResponse.json({ ok: true, isActive });
  }

  /* ---------------- profile / driver data ---------------- */
  const patch: Record<string, unknown> = {};

  if (typeof body.fullName === "string" && body.fullName.trim()) {
    patch.fullName = body.fullName.trim().slice(0, 120);
  }
  if (typeof body.email === "string" && body.email.trim()) {
    const email = body.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    patch.email = email;
  }
  if (typeof body.phone === "string") patch.phone = body.phone.trim().slice(0, 32) || null;
  if (typeof body.licenseNumber === "string") {
    patch.licenseNumber = body.licenseNumber.trim().slice(0, 40) || null;
  }
  if (typeof body.role === "string") {
    if (!["super_admin", "branch_manager", "driver"].includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (
      target.role === "super_admin" &&
      body.role !== "super_admin" &&
      (await countOtherActiveAdmins(target.id)) === 0
    ) {
      return NextResponse.json(
        { error: "At least one active fleet manager must remain" },
        { status: 400 }
      );
    }
    patch.role = body.role;
    if (body.role === "super_admin") patch.branchId = null;
  }
  if ("branchId" in body) {
    const nextRole = (patch.role as string) ?? target.role;
    if (nextRole !== "super_admin") {
      if (!body.branchId) {
        return NextResponse.json({ error: "Branch is required for this role" }, { status: 400 });
      }
      patch.branchId = String(body.branchId);
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(profiles)
      .set(patch)
      .where(eq(profiles.id, id))
      .returning();

    // A driver moving branch should not keep vehicles from the old branch.
    if (patch.branchId && patch.branchId !== target.branchId) {
      await db
        .update(vehicles)
        .set({ primaryDriverId: null })
        .where(
          and(eq(vehicles.primaryDriverId, id), ne(vehicles.branchId, String(patch.branchId)))
        );
    }

    await writeAudit({
      actorId: admin.id,
      action: "user.updated",
      entityType: "profile",
      entityId: id,
      branchId: updated.branchId,
      details: `Updated ${updated.fullName} · ${Object.keys(patch).join(", ")}`,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = isUniqueViolation(e)
      ? "Another user already uses this email"
      : "Could not update user";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/* ------------------------------------------------------------------ */
/* DELETE — remove teammate (safe deactivate, or permanent purge)      */
/* ------------------------------------------------------------------ */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const admin = guard.user!;
  const { id } = await params;
  const mode = request.nextUrl.searchParams.get("mode") ?? "auto";

  const rows = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
  const target = rows[0];
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (target.id === admin.id) {
    return NextResponse.json({ error: "You cannot remove your own account" }, { status: 400 });
  }
  if (target.role === "super_admin" && (await countOtherActiveAdmins(target.id)) === 0) {
    return NextResponse.json(
      { error: "At least one active fleet manager must remain" },
      { status: 400 }
    );
  }

  const logRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(mileageLogs)
    .where(eq(mileageLogs.driverId, id));
  const logCount = logRows[0]?.n ?? 0;

  // Preserve history by default: users with logs are deactivated, not deleted.
  if (mode !== "purge" && logCount > 0) {
    await db
      .update(profiles)
      .set({ isActive: false, failedAttempts: 0, lockedUntil: null })
      .where(eq(profiles.id, id));
    await db.update(vehicles).set({ primaryDriverId: null }).where(eq(vehicles.primaryDriverId, id));

    await writeAudit({
      actorId: admin.id,
      action: "user.deactivated",
      entityType: "profile",
      entityId: id,
      branchId: target.branchId,
      details: `Removed access for ${target.fullName} — ${logCount} mileage logs retained`,
    });

    return NextResponse.json({
      ok: true,
      mode: "deactivated",
      logCount,
      message: `${target.fullName} can no longer sign in. ${logCount} mileage logs were kept for reporting.`,
    });
  }

  await db.update(vehicles).set({ primaryDriverId: null }).where(eq(vehicles.primaryDriverId, id));
  await db.delete(profiles).where(eq(profiles.id, id));

  await writeAudit({
    actorId: admin.id,
    action: "user.deleted",
    entityType: "profile",
    entityId: null,
    branchId: target.branchId,
    details: `Permanently deleted ${target.fullName} (${target.email})${
      logCount > 0 ? ` and ${logCount} mileage logs` : ""
    }`,
  });

  return NextResponse.json({
    ok: true,
    mode: "deleted",
    logCount,
    message: `${target.fullName} was permanently deleted.`,
  });
}
