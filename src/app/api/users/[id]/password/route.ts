import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { writeAudit } from "@/lib/data";

/**
 * Reveals the current password to the fleet manager so it can be handed to a
 * driver. Super-admin only, and every read is written to the audit trail.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getSessionUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only the fleet manager (super admin) can view credentials" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const rows = await db
    .select({
      fullName: profiles.fullName,
      email: profiles.email,
      passwordPlain: profiles.passwordPlain,
      passwordSetAt: profiles.passwordSetAt,
    })
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1);

  const target = rows[0];
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await writeAudit({
    actorId: admin.id,
    action: "user.password_viewed",
    entityType: "profile",
    entityId: id,
    details: `Viewed credentials for ${target.fullName}`,
  });

  return NextResponse.json({
    fullName: target.fullName,
    email: target.email,
    password: target.passwordPlain,
    passwordSetAt: target.passwordSetAt.toISOString(),
  });
}
