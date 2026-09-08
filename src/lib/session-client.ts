"use client";

/**
 * Client-side session token bridge.
 *
 * Works alongside the httpOnly cookie: when the app is embedded cross-site and
 * cookies are blocked, the token is kept in localStorage, sent as a header on
 * API calls (authFetch) and appended as `?s=` on document navigations
 * (withToken). The server proxy lifts `?s=` back into a header.
 */

const TOKEN_KEY = "fp_token";
const TOKEN_HEADER = "x-fp-token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;

  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(TOKEN_KEY);
  } catch {
    stored = null; // storage blocked (private mode)
  }
  if (stored) return stored;

  // Fall back to the `?s=` bridge the page was opened with, so client-side
  // mutations keep working when cookies AND localStorage are unavailable.
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("s");
    if (fromUrl) {
      try {
        window.localStorage.setItem(TOKEN_KEY, fromUrl);
      } catch {
        /* ignore — still usable for this page view */
      }
      return fromUrl;
    }
  } catch {
    /* no-op */
  }
  return null;
}

export function setToken(token: string) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable */
  }
}

export function clearToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Append the session token to a URL for document-style navigations. */
export function withToken(href: string): string {
  const token = getToken();
  if (!token) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}s=${encodeURIComponent(token)}`;
}

/**
 * fetch() that always carries the session token as a header and includes credentials.
 * Callers handle error responses directly; never forcefully unmount the application.
 */
export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token && !headers.has(TOKEN_HEADER)) headers.set(TOKEN_HEADER, token);
  return fetch(input, { credentials: "include", ...init, headers });
}
