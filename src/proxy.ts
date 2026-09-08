import { NextRequest, NextResponse } from "next/server";
import { TOKEN_HEADER } from "@/lib/auth";

/**
 * Session bridge.
 *
 * The app is frequently rendered inside cross-site preview frames where the
 * browser blocks ALL cookies (even SameSite=None). For those cases the client
 * carries the session token as `?s=` on document navigations; here we lift it
 * into a request header so server components and route handlers can resolve
 * the session without relying on cookie storage at all.
 */
export default function proxy(request: NextRequest) {
  const queryToken = request.nextUrl.searchParams.get("s");
  if (!queryToken || request.headers.get(TOKEN_HEADER)) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(TOKEN_HEADER, queryToken.trim());

  // Keep `?s=` in the URL so server components can preserve it across
  // role-based redirects; only the header is injected for auth resolution.
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};
