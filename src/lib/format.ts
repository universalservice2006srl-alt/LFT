/**
 * Deterministic number formatting.
 *
 * `Intl.NumberFormat` output depends on the ICU data built into the runtime:
 * this sandbox's Node renders it-IT euros without the thousands grouping
 * ("1687 €") while every browser renders "1.687 €" — a guaranteed React
 * hydration mismatch. All formatters below are therefore hand-rolled so the
 * server and browser always produce identical strings.
 */
function group(intStr: string, sep: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export const fmtNumber = (n: number) => group(String(Math.round(n)), ",");

export const fmtKm = (n: number) => `${fmtNumber(n)} km`;

export const fmtEuro = (n: number) =>
  n >= 1000
    ? `${group(String(Math.round(n)), ".")} €`
    : `${n.toFixed(2).replace(".", ",")} €`;

export const fmtLiters = (n: number) => {
  const v = Math.round(n * 10) / 10;
  return `${Number.isInteger(v) ? String(v) : v.toFixed(1)} L`;
};

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function timeAgo(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function fmtTime(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
}

export function fmtDate(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Rome",
  });
}

export function fmtDateTime(iso: string | Date) {
  return `${fmtDate(iso)} · ${fmtTime(iso)}`;
}
