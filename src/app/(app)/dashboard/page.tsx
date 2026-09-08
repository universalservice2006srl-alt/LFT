import { redirect } from "next/navigation";
import { getSessionUser, getSParam, withS } from "@/lib/auth";
import { getDashboardStats, listBranches } from "@/lib/data";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await getSParam(searchParams);
  const user = await getSessionUser();
  if (!user) redirect("/");
  if (user.role === "driver") redirect(withS(s, "/drive"));

  const [stats, branches] = await Promise.all([
    getDashboardStats(user),
    user.role === "super_admin" ? listBranches() : Promise.resolve([]),
  ]);

  return <DashboardClient user={user} stats={stats} branches={branches} />;
}
