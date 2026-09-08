import {
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/**
 * Password hashing — scrypt via the Node standard library (no extra deps).
 * Format: scrypt$N$r$p$saltHex$hashHex
 */
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFKC"), salt, KEYLEN, {
    N,
    r: R,
    p: P,
  });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, n, r, p, saltHex, hashHex] = parts;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Human-friendly random password: 3 words + 3 digits, e.g. "Delta-Harbor-Fox-482".
 * Avoids ambiguous characters and is easy to read out over the phone.
 */
const WORDS_A = [
  "Alpha", "Bravo", "Cobalt", "Delta", "Ember", "Falcon", "Granite", "Harbor",
  "Indigo", "Juniper", "Kestrel", "Lumen", "Marble", "Nimbus", "Onyx", "Pilot",
  "Quartz", "Ridge", "Summit", "Tundra", "Umber", "Vector", "Willow", "Zenith",
];
const WORDS_B = [
  "Anchor", "Beacon", "Canyon", "Drift", "Echo", "Forge", "Glide", "Haven",
  "Ivory", "Jetty", "Kernel", "Lantern", "Meadow", "North", "Orbit", "Prairie",
  "Quiver", "River", "Stone", "Trail", "Union", "Valley", "Wander", "Yonder",
];
const WORDS_C = [
  "Fox", "Lynx", "Hawk", "Otter", "Ibis", "Wolf", "Crane", "Bison",
  "Heron", "Puma", "Raven", "Seal", "Tiger", "Viper", "Whale", "Zebra",
];

export function generatePassword(): string {
  const a = WORDS_A[randomInt(WORDS_A.length)];
  const b = WORDS_B[randomInt(WORDS_B.length)];
  const c = WORDS_C[randomInt(WORDS_C.length)];
  const digits = String(randomInt(100, 1000));
  return `${a}-${b}-${c}-${digits}`;
}

/** Minimum policy for admin-set passwords. */
export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (pw.length > 64) return "Password must be 64 characters or fewer";
  if (!/[a-zA-Z]/.test(pw)) return "Password must contain at least one letter";
  if (!/[0-9]/.test(pw)) return "Password must contain at least one number";
  return null;
}
