import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { SESSION_COOKIE, SESSION_MAX_AGE, homeForRole } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

const MAX_ATTEMPTS = 8;
const LOCK_MINUTES = 15;
const GENERIC = "Incorrect email or password";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const rows = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    const user = rows[0];

    // Constant-ish work factor whether or not the account exists.
    if (!user) {
      verifyPassword(password, `scrypt$16384$8$1$${"0".repeat(32)}$${"0".repeat(128)}`);
      return NextResponse.json({ error: GENERIC }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "This account is deactivated. Contact your fleet manager." },
        { status: 403 }
      );
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` },
        { status: 429 }
      );
    }

    if (!verifyPassword(password, user.passwordHash)) {
      const attempts = user.failedAttempts + 1;
      const lock = attempts >= MAX_ATTEMPTS;
      await db
        .update(profiles)
        .set({
          failedAttempts: lock ? 0 : attempts,
          lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
        })
        .where(eq(profiles.id, user.id));

      if (lock) {
        return NextResponse.json(
          { error: `Too many attempts. Account locked for ${LOCK_MINUTES} minutes.` },
          { status: 429 }
        );
      }
      const left = MAX_ATTEMPTS - attempts;
      return NextResponse.json(
        { error: `${GENERIC}. ${left} attempt${left === 1 ? "" : "s"} remaining.` },
        { status: 401 }
      );
    }

    await db
      .update(profiles)
      .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: sql`now()` })
      .where(eq(profiles.id, user.id));

    const store = await cookies();
    const isProd = process.env.NODE_ENV === "production";
    store.set(SESSION_COOKIE, user.id, {
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return NextResponse.json({
      ok: true,
      redirect: homeForRole(user.role),
      token: user.id,
      user: { fullName: user.fullName, role: user.role },
    });
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
