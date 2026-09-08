import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { listVehicleOptions, writeAudit } from "@/lib/data";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q");
  const result = await listVehicleOptions(user, q);
  return NextResponse.json({ vehicles: result });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "super_admin") {
    return NextResponse.json({ error: "Only super admins can register vehicles" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const plateNumber = String(body.plateNumber ?? "").toUpperCase().trim();
    const make = String(body.make ?? "").trim();
    const model = String(body.model ?? "").trim();
    const year = Math.round(Number(body.year));
    const fuelType = String(body.fuelType ?? "diesel").trim();
    const branchId = String(body.branchId ?? "");
    const primaryDriverId = body.primaryDriverId ? String(body.primaryDriverId) : null;
    const currentOdometer = Math.round(Number(body.currentOdometer ?? 0)) || 0;

    if (!plateNumber || !make || !model || !branchId || !year) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [inserted] = await db
      .insert(vehicles)
      .values({ plateNumber, make, model, year, fuelType, branchId, primaryDriverId, currentOdometer })
      .returning();

    await writeAudit({
      actorId: user.id,
      action: "vehicle.registered",
      entityType: "vehicle",
      entityId: inserted.id,
      branchId,
      details: `Registered ${make} ${model} · ${plateNumber}`,
    });

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes("unique")
      ? "A vehicle with this plate already exists"
      : "Could not create vehicle";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
