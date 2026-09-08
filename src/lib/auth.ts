import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { branches, profiles } from "@/db/schema";
import type { SessionUserDTO } from "@/lib/types";

export const SESSION_COOKIE = "fp_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
/** Header used to carry the session token when cookies are unavailable. */
export const TOKEN_HEADER = "x-fp-token";

/**
 * Resolves the current user from either:
 *  1. the `x-fp-token` request header (sent by authFetch / injected by proxy from `?s=`), or
 *  2. the httpOnly session cookie (regular first-party browsing).
 */
export async function getSessionUser(): Promise<SessionUserDTO | null> {
  const h = await headers();
  let id = h.get(TOKEN_HEADER);
  if (!id) {
    const store = await cookies();
    id = store.get(SESSION_COOKIE)?.value ?? null;
  }
  if (!id) return null;
  id = id.trim();

  // A malformed token must never reach the database as a uuid cast.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

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

/** Preserve the `?s=` token bridge across server-side redirects. */
export function withS(s: string | null, href: string) {
  return s ? `${href}${href.includes("?") ? "&" : "?"}s=${encodeURIComponent(s)}` : href;
}

export async function getSParam(
  searchParams: Promise<Record<string, string | string[] | undefined>>
): Promise<string | null> {
  try {
    const sp = await searchParams;
    const s = sp.s;
    return typeof s === "string" && s.length > 0 ? s : null;
  } catch {
    return null;
  }
}
