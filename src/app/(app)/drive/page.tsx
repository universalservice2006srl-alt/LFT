import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { branches, vehicles } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { listMyRecentLogs } from "@/lib/data";
import { DriverApp } from "@/components/driver/driver-app";
import type { VehicleOption } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DrivePage() {
  const user = await getSessionUser();
  if (!user) redirect("/");

  const rows = await db
    .select({
      id: vehicles.id,
      plateNumber: vehicles.plateNumber,
      make: vehicles.make,
      model: vehicles.model,
      year: vehicles.year,
      branchId: vehicles.branchId,
      branchName: branches.name,
      status: vehicles.status,
      primaryDriverId: vehicles.primaryDriverId,
      currentOdometer: vehicles.currentOdometer,
    })
    .from(vehicles)
    .innerJoin(branches, eq(branches.id, vehicles.branchId))
    .where(and(eq(vehicles.primaryDriverId, user.id), eq(vehicles.status, "active")))
    .orderBy(asc(vehicles.plateNumber));

  const myVehicles: VehicleOption[] = rows.map((v) => ({
    id: v.id,
    plateNumber: v.plateNumber,
    label: `${v.make} ${v.model} · ${v.year}`,
    make: v.make,
    model: v.model,
    branchId: v.branchId,
    branchName: v.branchName,
    status: v.status,
    primaryDriverId: v.primaryDriverId,
    primaryDriverName: user.fullName,
    currentOdometer: v.currentOdometer,
  }));

  const recentLogs = await listMyRecentLogs(user, 14);

  return <DriverApp user={user} myVehicles={myVehicles} recentLogs={recentLogs} />;
}
