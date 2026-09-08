import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getSessionUser, getSParam, homeForRole, withS } from "@/lib/auth";
import { LoginScreen, type DemoHint } from "@/components/login-screen";

export const dynamic = "force-dynamic";

/**
 * Demo credentials are only surfaced when SHOW_DEMO_CREDENTIALS is not "false".
 * Set SHOW_DEMO_CREDENTIALS=false in a real deployment to hide them entirely.
 */
async function loadDemoHints(): Promise<DemoHint[]> {
  if (process.env.SHOW_DEMO_CREDENTIALS === "false") return [];

  const roles = ["super_admin", "branch_manager", "driver"] as const;
  const hints: DemoHint[] = [];
  for (const role of roles) {
    const rows = await db
      .select({
        role: profiles.role,
        email: profiles.email,
        passwordPlain: profiles.passwordPlain,
      })
      .from(profiles)
      .where(eq(profiles.role, role))
      .orderBy(asc(profiles.fullName))
      .limit(1);
    const r = rows[0];
    if (r?.passwordPlain) {
      hints.push({ role: r.role, email: r.email, password: r.passwordPlain });
    }
  }
  return hints;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await getSParam(searchParams);
  const session = await getSessionUser();
  if (session) redirect(withS(s ?? session.id, homeForRole(session.role)));

  const demo = await loadDemoHints();
  return <LoginScreen demo={demo} />;
}
