import { NextResponse } from "next/server";
import { and, asc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { branches, profiles, vehicles } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

/**
 * Drivers a manager may file an entry for.
 * Super admin → everyone. Branch manager → their own branch only.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "driver") {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const conds: SQL[] = [eq(profiles.isActive, true), eq(profiles.role, "driver")];
  if (user.role === "branch_manager" && user.branchId) {
    conds.push(eq(profiles.branchId, user.branchId));
  }

  const rows = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      role: profiles.role,
      branchId: profiles.branchId,
      branchName: branches.name,
    })
    .from(profiles)
    .leftJoin(branches, eq(branches.id, profiles.branchId))
    .where(and(...conds))
    .orderBy(asc(profiles.fullName));

  // plate hints so the picker can show each driver's assigned vehicle
  const assigned = await db
    .select({ driverId: vehicles.primaryDriverId, plate: vehicles.plateNumber })
    .from(vehicles);
  const plateMap = new Map<string, string[]>();
  for (const a of assigned) {
    if (!a.driverId) continue;
    plateMap.set(a.driverId, [...(plateMap.get(a.driverId) ?? []), a.plate]);
  }

  return NextResponse.json({
    drivers: rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      role: r.role,
      branchId: r.branchId,
      branchName: r.branchName,
      plates: plateMap.get(r.id) ?? [],
    })),
  });
}
