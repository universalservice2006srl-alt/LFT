import { redirect } from "next/navigation";
import { getSessionUser, homeForRole } from "@/lib/auth";
import { LoginScreen, type DemoHint } from "@/components/login-screen";
import { db } from "@/db";
import { branches, mileageLogs, profiles, vehicles } from "@/db/schema";
import { count, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function loadDemoHints(): Promise<DemoHint[]> {
  return [];
}

async function loadLoginStats() {
  const [branchCount, vehicleCount, activeUserCount, logCount] = await Promise.all([
    db.select({ count: count() }).from(branches),
    db.select({ count: count() }).from(vehicles),
    db.select({ count: count() }).from(profiles).where(eq(profiles.isActive, true)),
    db.select({ count: count() }).from(mileageLogs),
  ]);

  return {
    branches: branchCount[0]?.count ?? 0,
    vehicles: vehicleCount[0]?.count ?? 0,
    activeUsers: activeUserCount[0]?.count ?? 0,
    logs: logCount[0]?.count ?? 0,
  };
}

export default async function Home({
  searchParams: _searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionUser();
  if (session) redirect(homeForRole(session.role));

  const [demo, stats] = await Promise.all([loadDemoHints(), loadLoginStats()]);
  return <LoginScreen demo={demo} stats={stats} />;
}
