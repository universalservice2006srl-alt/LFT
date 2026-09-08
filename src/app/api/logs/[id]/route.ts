import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { mileageLogs, refuelLogs, vehicles } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { writeAudit } from "@/lib/data";
import { APPROVER_ROLES, TRIP_PURPOSES } from "@/lib/constants";

const VALID_PURPOSES = new Set(TRIP_PURPOSES.map((p) => p.value));

/** Recompute a vehicle's odometer from its remaining logs. */
async function syncVehicleOdometer(vehicleId: string) {
  const rows = await db
    .select({ odometerValue: mileageLogs.odometerValue })
    .from(mileageLogs)
    .where(eq(mileageLogs.vehicleId, vehicleId))
    .orderBy(desc(mileageLogs.odometerValue))
    .limit(1);
  if (rows[0]) {
    await db
      .update(vehicles)
      .set({ currentOdometer: rows[0].odometerValue })
      .where(eq(vehicles.id, vehicleId));
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!APPROVER_ROLES.includes(user.role as (typeof APPROVER_ROLES)[number])) {
    return NextResponse.json(
      { error: "Only a local office manager or fleet manager can modify entries" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json();
  const action = String(body.action ?? "");

  const rows = await db.select().from(mileageLogs).where(eq(mileageLogs.id, id)).limit(1);
  const log = rows[0];
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "branch_manager" && log.branchId !== user.branchId) {
    return NextResponse.json({ error: "Outside your branch scope" }, { status: 403 });
  }

  /* ------------------------------------------------------------------ */
  /* Full edit — super admin only                                        */
  /* ------------------------------------------------------------------ */
  if (action === "edit") {
    // Branch scope was already enforced above, so a local office manager may
    // correct entries belonging to their own branch.
    if (user.role !== "super_admin" && user.role !== "branch_manager") {
      return NextResponse.json(
        { error: "Only a fleet manager or local office manager can edit log data" },
        { status: 403 }
      );
    }

    const patch: Record<string, unknown> = {};

    if (body.odometerValue != null) {
      const odo = Math.round(Number(body.odometerValue));
      if (!Number.isFinite(odo) || odo <= 0 || odo > 2_000_000) {
        return NextResponse.json({ error: "Enter a valid odometer reading" }, { status: 400 });
      }
      patch.odometerValue = odo;
    }
    if (body.distanceKm != null) {
      const d = Math.round(Number(body.distanceKm));
      if (!Number.isFinite(d) || d < 0) {
        return NextResponse.json({ error: "Enter a valid distance" }, { status: 400 });
      }
      patch.distanceKm = d;
    }
    if (typeof body.entryType === "string") {
      if (!["morning", "evening", "refuel"].includes(body.entryType)) {
        return NextResponse.json({ error: "Invalid entry type" }, { status: 400 });
      }
      patch.entryType = body.entryType;
    }
    if (typeof body.isTemporaryDriver === "boolean") {
      patch.isTemporaryDriver = body.isTemporaryDriver;
      if (!body.isTemporaryDriver) patch.tripPurpose = null;
    }
    if ("tripPurpose" in body) {
      const tp = body.tripPurpose ? String(body.tripPurpose) : null;
      if (tp && !VALID_PURPOSES.has(tp as never)) {
        return NextResponse.json({ error: "Invalid trip purpose" }, { status: 400 });
      }
      patch.tripPurpose = tp;
    }
    if (typeof body.note === "string") patch.note = body.note.slice(0, 500) || null;
    if (typeof body.status === "string") {
      if (!["pending", "approved", "flagged"].includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      patch.status = body.status;
      patch.reviewedBy = body.status === "pending" ? null : user.id;
      patch.reviewedAt = body.status === "pending" ? null : new Date();
    }

    const isTemp =
      (patch.isTemporaryDriver as boolean | undefined) ?? log.isTemporaryDriver;
    const purpose = ("tripPurpose" in patch ? patch.tripPurpose : log.tripPurpose) as
      | string
      | null;
    if (isTemp && !purpose) {
      return NextResponse.json(
        { error: "A trip purpose is required for temporary-driver entries" },
        { status: 400 }
      );
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await db.update(mileageLogs).set(patch).where(eq(mileageLogs.id, id));

    // Optional refuel figures
    if (body.refuel && typeof body.refuel === "object") {
      const liters = Number(body.refuel.liters);
      const totalCost = Number(body.refuel.totalCost);
      if (Number.isFinite(liters) && liters > 0 && Number.isFinite(totalCost) && totalCost > 0) {
        const existing = await db
          .select()
          .from(refuelLogs)
          .where(eq(refuelLogs.mileageLogId, id))
          .limit(1);
        const values = {
          liters: liters.toFixed(2),
          totalCost: totalCost.toFixed(2),
          pricePerLiter: (totalCost / liters).toFixed(3),
          stationName: body.refuel.stationName
            ? String(body.refuel.stationName).slice(0, 120)
            : null,
        };
        if (existing[0]) {
          await db.update(refuelLogs).set(values).where(eq(refuelLogs.mileageLogId, id));
        } else {
          await db.insert(refuelLogs).values({ mileageLogId: id, ...values });
        }
      }
    }

    if (patch.odometerValue) await syncVehicleOdometer(log.vehicleId);

    await writeAudit({
      actorId: user.id,
      action: "log.edited",
      entityType: "mileage_log",
      entityId: id,
      branchId: log.branchId,
      details: `Edited entry · ${Object.keys(patch).join(", ")}`,
    });

    return NextResponse.json({ ok: true });
  }

  /* ------------------------------------------------------------------ */
  /* Review actions — branch manager or super admin                      */
  /* ------------------------------------------------------------------ */
  const statusMap: Record<string, "approved" | "flagged" | "pending"> = {
    approve: "approved",
    flag: "flagged",
    reopen: "pending",
  };
  const next = statusMap[action];
  if (!next) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const reviewedAt = next === "pending" ? null : new Date();
  await db
    .update(mileageLogs)
    .set({
      status: next,
      reviewedBy: next === "pending" ? null : user.id,
      reviewedAt,
    })
    .where(eq(mileageLogs.id, id));

  await writeAudit({
    actorId: user.id,
    action: `log.${next === "pending" ? "reopened" : next}`,
    entityType: "mileage_log",
    entityId: id,
    branchId: log.branchId,
    details: `${next} · ${log.entryType} entry · ${log.odometerValue.toLocaleString()} km`,
  });

  return NextResponse.json({
    ok: true,
    status: next,
    reviewerName: next === "pending" ? null : user.fullName,
    reviewerRole: next === "pending" ? null : user.role,
    reviewedAt: reviewedAt ? reviewedAt.toISOString() : null,
  });
}

/* ------------------------------------------------------------------ */
/* DELETE — fleet manager (any) or office manager (own branch)         */
/* ------------------------------------------------------------------ */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!APPROVER_ROLES.includes(user.role as (typeof APPROVER_ROLES)[number])) {
    return NextResponse.json(
      { error: "Only a fleet manager or local office manager can delete log entries" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const rows = await db.select().from(mileageLogs).where(eq(mileageLogs.id, id)).limit(1);
  const log = rows[0];
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "branch_manager" && log.branchId !== user.branchId) {
    return NextResponse.json({ error: "Outside your branch scope" }, { status: 403 });
  }

  await db.delete(mileageLogs).where(eq(mileageLogs.id, id)); // refuel cascades
  await syncVehicleOdometer(log.vehicleId);

  await writeAudit({
    actorId: user.id,
    action: "log.deleted",
    entityType: "mileage_log",
    entityId: null,
    branchId: log.branchId,
    details: `Deleted ${log.entryType} entry · ${log.odometerValue.toLocaleString()} km`,
  });

  return NextResponse.json({ ok: true });
}
