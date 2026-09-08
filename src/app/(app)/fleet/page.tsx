import { redirect } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getSessionUser, getSParam, withS } from "@/lib/auth";
import { listBranches, listFleet } from "@/lib/data";
import { FleetClient, type DriverOption } from "@/components/fleet/fleet-client";

export const dynamic = "force-dynamic";

export default async function FleetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await getSParam(searchParams);
  const user = await getSessionUser();
  if (!user) redirect("/");
  if (user.role === "driver") redirect(withS(s, "/drive"));

  const [fleet, branches, driverRows] = await Promise.all([
    listFleet(user),
    user.role === "super_admin" ? listBranches() : Promise.resolve([]),
    user.role === "super_admin"
      ? db
          .select({ id: profiles.id, fullName: profiles.fullName, branchId: profiles.branchId })
          .from(profiles)
          .where(inArray(profiles.role, ["driver", "branch_manager"]))
          .orderBy(asc(profiles.fullName))
      : Promise.resolve([]),
  ]);

  const drivers: DriverOption[] = driverRows.map((d) => ({
    id: d.id,
    fullName: d.fullName,
    branchId: d.branchId,
  }));

  return <FleetClient user={user} fleet={fleet} branches={branches} drivers={drivers} />;
}
