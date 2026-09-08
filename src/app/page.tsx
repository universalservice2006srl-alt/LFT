import { redirect } from "next/navigation";
import { getSessionUser, homeForRole } from "@/lib/auth";
import { LoginScreen, type DemoHint } from "@/components/login-screen";

export const dynamic = "force-dynamic";

async function loadDemoHints(): Promise<DemoHint[]> {
  return [];
}

export default async function Home({
  searchParams: _searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionUser();
  if (session) redirect(homeForRole(session.role));

  const demo = await loadDemoHints();
  return <LoginScreen demo={demo} />;
}
