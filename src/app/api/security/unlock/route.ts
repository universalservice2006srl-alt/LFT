import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { writeAudit } from "@/lib/data";

/** Clear a lockout / failed-attempt counter for an account. */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only the fleet manager can unlock accounts" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const id = String(body.profileId ?? "");
  if (!id) return NextResponse.json({ error: "profileId required" }, { status: 400 });

  const rows = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
  const target = rows[0];
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await db
    .update(profiles)
    .set({ failedAttempts: 0, lockedUntil: null })
    .where(eq(profiles.id, id));

  await writeAudit({
    actorId: user.id,
    action: "user.unlocked",
    entityType: "profile",
    entityId: id,
    branchId: target.branchId,
    details: `Cleared lockout for ${target.fullName}`,
  });

  return NextResponse.json({ ok: true });
}
