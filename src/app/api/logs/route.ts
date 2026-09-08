import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mileageLogs, profiles, refuelLogs, vehicles } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { listLogs, writeAudit } from "@/lib/data";
import { FEATURES, TRIP_PURPOSES } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const data = await listLogs(user, {
    branchId: sp.get("branch") || null,
    entryType: sp.get("type") || null,
    usage: (sp.get("usage") as "assigned" | "temporary" | null) || null,
    status: sp.get("status") || null,
    q: sp.get("q") || null,
    from: sp.get("from") || null,
    to: sp.get("to") || null,
    driverId: sp.get("driver") || null,
    page: Number(sp.get("page") ?? 1),
    limit: Number(sp.get("limit") ?? 15),
  });
  return NextResponse.json(data);
}

const VALID_PURPOSES = new Set(TRIP_PURPOSES.map((p) => p.value));

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const vehicleId = String(body.vehicleId ?? "");
    const entryType = String(body.entryType ?? "");
    const odometerValue = Math.round(Number(body.odometerValue));
    const tripPurpose = body.tripPurpose ? String(body.tripPurpose) : null;
    const requestedCreatedAt = body.createdAt ? String(body.createdAt) : null;
    // Photo capture is currently switched off — ignore any inbound image data.
    const photoUrl = FEATURES.photoCapture && body.photoUrl ? String(body.photoUrl) : null;
    const note = body.note ? String(body.note).slice(0, 500) : null;
    const lat = body.locationLat != null ? Number(body.locationLat) : null;
    const lng = body.locationLng != null ? Number(body.locationLng) : null;

    if (!vehicleId || !["morning", "evening", "refuel"].includes(entryType)) {
      return NextResponse.json({ error: "Invalid entry" }, { status: 400 });
    }
    if (!Number.isFinite(odometerValue) || odometerValue <= 0 || odometerValue > 2_000_000) {
      return NextResponse.json({ error: "Enter a valid odometer reading" }, { status: 400 });
    }

    let createdAt: Date | undefined;
    if (requestedCreatedAt) {
      if (user.role === "driver") {
        return NextResponse.json(
          { error: "Drivers cannot choose the entry date and time" },
          { status: 403 }
        );
      }
      createdAt = new Date(requestedCreatedAt);
      if (!Number.isFinite(createdAt.getTime())) {
        return NextResponse.json({ error: "Enter a valid entry date and time" }, { status: 400 });
      }
      if (createdAt.getTime() > Date.now()) {
        return NextResponse.json({ error: "Entry date and time cannot be in the future" }, { status: 400 });
      }
    }

    const vRows = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
    const vehicle = vRows[0];
    if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    if (vehicle.status !== "active") {
      return NextResponse.json({ error: "Vehicle is not active" }, { status: 400 });
    }

    /* ------------------------------------------------------------------ */
    /* Managers may record an entry on behalf of another driver.          */
    /* Super admin: any driver + any vehicle.                             */
    /* Branch manager: drivers and vehicles inside their own branch only. */
    /* ------------------------------------------------------------------ */
    const requestedDriverId = body.driverId ? String(body.driverId) : null;
    let driverId = user.id;
    let onBehalf: { name: string } | null = null;

    if (user.role !== "driver" && !requestedDriverId) {
      return NextResponse.json({ error: "Select a driver for this entry" }, { status: 400 });
    }

    if (requestedDriverId && (user.role !== "driver" || requestedDriverId !== user.id)) {
      if (user.role === "driver") {
        return NextResponse.json(
          { error: "Drivers can only submit their own entries" },
          { status: 403 }
        );
      }
      const dRows = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, requestedDriverId))
        .limit(1);
      const driver = dRows[0];
      if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });
      if (!driver.isActive || driver.role !== "driver") {
        return NextResponse.json({ error: "Select an active driver" }, { status: 400 });
      }

      if (user.role === "branch_manager") {
        if (driver.branchId !== user.branchId) {
          return NextResponse.json(
            { error: "That driver belongs to another branch" },
            { status: 403 }
          );
        }
        if (vehicle.branchId !== user.branchId) {
          return NextResponse.json(
            { error: "That vehicle belongs to another branch" },
            { status: 403 }
          );
        }
      }
      driverId = driver.id;
      onBehalf = { name: driver.fullName };
    } else if (user.role === "branch_manager" && vehicle.branchId !== user.branchId) {
      return NextResponse.json(
        { error: "That vehicle belongs to another branch" },
        { status: 403 }
      );
    }

    const isTemporary = vehicle.primaryDriverId !== driverId;
    if (isTemporary && (!tripPurpose || !VALID_PURPOSES.has(tripPurpose as never))) {
      return NextResponse.json(
        { error: "A trip purpose is required when logging a vehicle that is not assigned to that driver." },
        { status: 400 }
      );
    }

    let refuel: {
      liters: number;
      totalCost: number;
      stationName?: string | null;
      receiptUrl?: string | null;
    } | null = null;

    if (entryType === "refuel") {
      const liters = Number(body.refuel?.liters);
      const totalCost = Number(body.refuel?.totalCost);
      if (!Number.isFinite(liters) || liters <= 0 || liters > 300) {
        return NextResponse.json({ error: "Enter valid liters" }, { status: 400 });
      }
      if (!Number.isFinite(totalCost) || totalCost <= 0 || totalCost > 2000) {
        return NextResponse.json({ error: "Enter a valid total cost" }, { status: 400 });
      }
      refuel = {
        liters,
        totalCost,
        stationName: body.refuel?.stationName ? String(body.refuel.stationName).slice(0, 120) : null,
        receiptUrl:
          FEATURES.photoCapture && body.refuel?.receiptUrl
            ? String(body.refuel.receiptUrl)
            : null,
      };
    }

    const distanceKm = Math.max(0, odometerValue - vehicle.currentOdometer);
    // Automatic review trigger: odometer entered is lower than the recorded one
    const autoFlag = odometerValue < vehicle.currentOdometer - 5;
    const status = autoFlag ? "flagged" : "pending";

    const behalfNote = onBehalf
      ? `Recorded by ${user.fullName} (${
          user.role === "super_admin" ? "fleet manager" : "office manager"
        }) on behalf of ${onBehalf.name}.`
      : null;

    const [inserted] = await db
      .insert(mileageLogs)
      .values({
        driverId,
        vehicleId: vehicle.id,
        branchId: vehicle.branchId,
        entryType: entryType as never,
        odometerValue,
        distanceKm,
        isTemporaryDriver: isTemporary,
        tripPurpose: isTemporary ? (tripPurpose as never) : null,
        status: status as never,
        photoUrl,
        locationLat: lat != null && Number.isFinite(lat) ? String(lat) : null,
        locationLng: lng != null && Number.isFinite(lng) ? String(lng) : null,
        note:
          [
            autoFlag
              ? `Auto-flagged: reading ${odometerValue.toLocaleString()} km is below the vehicle record (${vehicle.currentOdometer.toLocaleString()} km).`
              : note,
            behalfNote,
          ]
            .filter(Boolean)
            .join(" ") || null,
          ...(createdAt ? { createdAt } : {}),
      })
      .returning();

    if (refuel) {
      await db.insert(refuelLogs).values({
        mileageLogId: inserted.id,
        liters: refuel.liters.toFixed(2),
        totalCost: refuel.totalCost.toFixed(2),
        pricePerLiter: (refuel.totalCost / refuel.liters).toFixed(3),
        stationName: refuel.stationName ?? null,
        receiptUrl: refuel.receiptUrl ?? null,
      });
    }

    if (odometerValue > vehicle.currentOdometer) {
      await db
        .update(vehicles)
        .set({ currentOdometer: odometerValue })
        .where(eq(vehicles.id, vehicle.id));
    }

    await writeAudit({
      actorId: user.id,
      action: onBehalf
        ? "log.created.on_behalf"
        : isTemporary
          ? "log.created.temporary"
          : "log.created",
      entityType: "mileage_log",
      entityId: inserted.id,
      branchId: vehicle.branchId,
      details: `${entryType} entry · ${vehicle.plateNumber} · ${odometerValue.toLocaleString()} km${
        onBehalf ? ` · filed for ${onBehalf.name}` : ""
      }${isTemporary ? ` · temporary driver (${tripPurpose})` : ""}${
        autoFlag ? " · AUTO-FLAGGED odometer regression" : ""
      }`,
    });

    return NextResponse.json({
      ok: true,
      id: inserted.id,
      status,
      isTemporary,
      onBehalfOf: onBehalf?.name ?? null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save the entry" }, { status: 500 });
  }
}
