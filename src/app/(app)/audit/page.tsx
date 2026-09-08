import { redirect } from "next/navigation";
import { getSessionUser, getSParam, withS } from "@/lib/auth";
import { listAudit } from "@/lib/data";
import { AuditClient, type SerializedAuditRow } from "@/components/audit/audit-client";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await getSParam(searchParams);
  const user = await getSessionUser();
  if (!user) redirect("/");
  // Fleet managers see everything; office managers see their own branch.
  if (user.role === "driver") redirect(withS(s, "/drive"));

  const rows = await listAudit(100, user);
  const serialized: SerializedAuditRow[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    details: r.details,
    actorName: r.actorName,
    branchName: r.branchName,
    createdAt: r.createdAt.toISOString(),
  }));

  return <AuditClient user={user} rows={serialized} />;
}
