import { eq } from "drizzle-orm";
import { db } from "@/db";
import { branches, profiles } from "@/db/schema";
import type { SessionUserDTO } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSessionUser(): Promise<SessionUserDTO | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const id = data.user.id;

  const rows = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      email: profiles.email,
      role: profiles.role,
      branchId: profiles.branchId,
      avatarColor: profiles.avatarColor,
      isActive: profiles.isActive,
      branchName: branches.name,
      branchCode: branches.code,
    })
    .from(profiles)
    .leftJoin(branches, eq(branches.id, profiles.branchId))
    .where(eq(profiles.id, id))
    .limit(1);

  const u = rows[0];
  // Deactivated accounts lose access immediately, even with a live session.
  if (!u || !u.isActive) return null;
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    branchId: u.branchId,
    branchName: u.branchName ?? null,
    branchCode: u.branchCode ?? null,
    avatarColor: u.avatarColor,
  };
}

export function homeForRole(role: SessionUserDTO["role"]) {
  return role === "driver" ? "/drive" : "/dashboard";
}

export function withS(_s: string | null, href: string) {
  return href;
}

export async function getSParam(
  _searchParams: Promise<Record<string, string | string[] | undefined>>
): Promise<string | null> {
  return null;
}
