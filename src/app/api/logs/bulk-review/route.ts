import { NextRequest, NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { mileageLogs } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { writeAudit } from "@/lib/data";
import { APPROVER_ROLES } from "@/lib/constants";

/**
 * Approve / flag / reopen several entries at once — used by the verification
 * report where a manager reviews a whole vehicle-day in one action.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!APPROVER_ROLES.includes(user.role as (typeof APPROVER_ROLES)[number])) {
    return NextResponse.json(
      { error: "Only a fleet manager or local office manager can review entries" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 200) : [];
  const action = String(body.action ?? "");
  const statusMap: Record<string, "approved" | "flagged" | "pending"> = {
    approve: "approved",
    flag: "flagged",
    reopen: "pending",
  };
  const next = statusMap[action];

  if (ids.length === 0) return NextResponse.json({ error: "No entries selected" }, { status: 400 });
  if (!next) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const rows = await db.select().from(mileageLogs).where(inArray(mileageLogs.id, ids));
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Office managers may only review their own branch.
  if (user.role === "branch_manager" && rows.some((r) => r.branchId !== user.branchId)) {
    return NextResponse.json({ error: "Outside your branch scope" }, { status: 403 });
  }

  const reviewedAt = next === "pending" ? null : new Date();
  await db
    .update(mileageLogs)
    .set({
      status: next,
      reviewedBy: next === "pending" ? null : user.id,
      reviewedAt,
    })
    .where(inArray(mileageLogs.id, ids));

  await writeAudit({
    actorId: user.id,
    action: `log.${next === "pending" ? "reopened" : next}`,
    entityType: "mileage_log",
    entityId: rows[0].id,
    branchId: rows[0].branchId,
    details: `${next} ${rows.length} entr${rows.length === 1 ? "y" : "ies"} from the verification report`,
  });

  return NextResponse.json({ ok: true, status: next, count: rows.length });
}
