import { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

/**
 * Session bridge.
 *
 * The app is frequently rendered inside cross-site preview frames where the
 * browser blocks ALL cookies (even SameSite=None). For those cases the client
 * carries the session token as `?s=` on document navigations; here we lift it
 * into a request header so server components and route handlers can resolve
 * the session without relying on cookie storage at all.
 */
export default async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};
