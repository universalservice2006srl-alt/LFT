import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { mileageLogs, vehicles } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { writeAudit } from "@/lib/data";
import { isUniqueViolation } from "@/lib/db-errors";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only the fleet manager (super admin) can edit vehicles" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json();

  const rows = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  const current = rows[0];
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = {};

  if (typeof body.plateNumber === "string" && body.plateNumber.trim()) {
    patch.plateNumber = body.plateNumber.trim().toUpperCase().slice(0, 16);
  }
  if (typeof body.make === "string" && body.make.trim()) {
    patch.make = body.make.trim().slice(0, 60);
  }
  if (typeof body.model === "string" && body.model.trim()) {
    patch.model = body.model.trim().slice(0, 60);
  }
  if (body.year != null) {
    const y = Math.round(Number(body.year));
    if (!Number.isFinite(y) || y < 1980 || y > 2100) {
      return NextResponse.json({ error: "Enter a valid year" }, { status: 400 });
    }
    patch.year = y;
  }
  if (typeof body.fuelType === "string" && body.fuelType.trim()) {
    patch.fuelType = body.fuelType.trim().slice(0, 24);
  }
  if (body.currentOdometer != null) {
    const odo = Math.round(Number(body.currentOdometer));
    if (!Number.isFinite(odo) || odo < 0 || odo > 2_000_000) {
      return NextResponse.json({ error: "Enter a valid odometer value" }, { status: 400 });
    }
    patch.currentOdometer = odo;
  }
  if (body.status && ["active", "maintenance", "retired"].includes(body.status)) {
    patch.status = body.status;
  }
  if ("primaryDriverId" in body) {
    patch.primaryDriverId = body.primaryDriverId || null;
  }
  if (body.branchId) patch.branchId = String(body.branchId);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const updated = (
      await db.update(vehicles).set(patch).where(eq(vehicles.id, id)).returning()
    )[0];

    await writeAudit({
      actorId: user.id,
      action: "vehicle.updated",
      entityType: "vehicle",
      entityId: id,
      branchId: updated.branchId,
      details: `Updated ${updated.plateNumber} · ${Object.keys(patch).join(", ")}`,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = isUniqueViolation(e)
      ? "Another vehicle already uses this plate"
      : "Could not update vehicle";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/* ------------------------------------------------------------------ */
/* DELETE — retire (safe) or purge with all logs                       */
/* ------------------------------------------------------------------ */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only the fleet manager (super admin) can delete vehicles" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const mode = request.nextUrl.searchParams.get("mode") ?? "auto";

  const rows = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  const vehicle = rows[0];
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const logRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(mileageLogs)
    .where(eq(mileageLogs.vehicleId, id));
  const logCount = logRows[0]?.n ?? 0;

  // Preserve reporting history by default.
  if (mode !== "purge" && logCount > 0) {
    await db
      .update(vehicles)
      .set({ status: "retired", primaryDriverId: null })
      .where(eq(vehicles.id, id));

    await writeAudit({
      actorId: user.id,
      action: "vehicle.retired",
      entityType: "vehicle",
      entityId: id,
      branchId: vehicle.branchId,
      details: `Retired ${vehicle.plateNumber} — ${logCount} mileage logs retained`,
    });

    return NextResponse.json({
      ok: true,
      mode: "retired",
      logCount,
      message: `${vehicle.plateNumber} was retired. ${logCount} mileage logs were kept for reporting.`,
    });
  }

  await db.delete(vehicles).where(eq(vehicles.id, id)); // logs cascade

  await writeAudit({
    actorId: user.id,
    action: "vehicle.deleted",
    entityType: "vehicle",
    entityId: null,
    branchId: vehicle.branchId,
    details: `Permanently deleted ${vehicle.plateNumber}${
      logCount > 0 ? ` and ${logCount} mileage logs` : ""
    }`,
  });

  return NextResponse.json({
    ok: true,
    mode: "deleted",
    logCount,
    message: `${vehicle.plateNumber} was permanently deleted.`,
  });
}
