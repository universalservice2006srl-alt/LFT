import { redirect } from "next/navigation";
import { getSessionUser, getSParam, withS } from "@/lib/auth";
import { getSecurityOverview } from "@/lib/data";
import { SecurityClient, type SerializedEvent } from "@/components/security/security-client";

export const dynamic = "force-dynamic";

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await getSParam(searchParams);
  const user = await getSessionUser();
  if (!user) redirect("/");
  if (user.role !== "super_admin") {
    redirect(withS(s, user.role === "driver" ? "/drive" : "/dashboard"));
  }

  const overview = await getSecurityOverview();
  const events: SerializedEvent[] = overview.events.map((e) => ({
    id: e.id,
    action: e.action,
    details: e.details,
    actorName: e.actorName,
    createdAt: e.createdAt.toISOString(),
  }));

  return (
    <SecurityClient
      user={user}
      accounts={overview.accounts}
      stats={overview.stats}
      events={events}
    />
  );
}
