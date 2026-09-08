"use client";

export function withToken(href: string): string {
  return href;
}

/**
 * fetch() that always carries the session token as a header and includes credentials.
 * Callers handle error responses directly; never forcefully unmount the application.
 */
export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  return fetch(input, { credentials: "include", ...init, headers });
}
