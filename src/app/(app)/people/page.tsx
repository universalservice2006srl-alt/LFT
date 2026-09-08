import { redirect } from "next/navigation";
import { getSessionUser, getSParam, withS } from "@/lib/auth";
import { listBranches, listPeople } from "@/lib/data";
import { PeopleClient } from "@/components/people/people-client";

export const dynamic = "force-dynamic";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await getSParam(searchParams);
  const user = await getSessionUser();
  if (!user) redirect("/");
  if (user.role === "driver") redirect(withS(s, "/drive"));

  const [people, branches] = await Promise.all([
    listPeople(user),
    user.role === "super_admin" ? listBranches() : Promise.resolve([]),
  ]);

  return <PeopleClient user={user} people={people} branches={branches} />;
}
