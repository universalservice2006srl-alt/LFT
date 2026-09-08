import { redirect } from "next/navigation";
import { getSessionUser, getSParam, withS } from "@/lib/auth";
import { getVehicleDailyReport, listBranches } from "@/lib/data";
import { ReportsClient } from "@/components/reports/reports-client";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await getSParam(searchParams);
  const user = await getSessionUser();
  if (!user) redirect("/");
  if (user.role === "driver") redirect(withS(s, "/drive"));

  const [report, branches] = await Promise.all([
    getVehicleDailyReport(user, {}),
    user.role === "super_admin" ? listBranches() : Promise.resolve([]),
  ]);

  return <ReportsClient user={user} initial={report} branches={branches} />;
}
