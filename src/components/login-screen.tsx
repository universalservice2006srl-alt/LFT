"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Gauge,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Route,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/session-client";

export type DemoHint = { role: string; email: string; password: string | null };

const MARQUEE = [
  "8 branch offices",
  "48 fleet vehicles",
  "53 active users",
  "6,000+ mileage logs",
  "Live fuel analytics",
  "Temporary-driver auditing",
];

export function LoginScreen({ demo }: { demo: DemoHint[] }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);

  async function signIn(e?: React.FormEvent) {
    e?.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sign in failed");
      setLaunching(data.user?.fullName ?? "there");
      const target = typeof data.redirect === "string" ? data.redirect : "/dashboard";
      window.setTimeout(() => window.location.assign(target), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setSubmitting(false);
    }
  }

  function useDemo(hint: DemoHint) {
    setEmail(hint.email);
    setPassword(hint.password ?? "");
    setError(null);
  }

  return (
    <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ---------------------------- Brand panel ---------------------------- */}
      <section className="relative flex max-h-[248px] flex-col overflow-hidden bg-navy text-cream sm:max-h-[330px] lg:max-h-none lg:min-h-dvh">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 10%, rgba(8,220,125,0.16), transparent 42%), radial-gradient(circle at 85% 80%, rgba(36,91,193,0.35), transparent 46%)",
          }}
        />
        <svg
          className="pointer-events-none absolute -right-24 top-24 hidden h-[520px] w-[520px] opacity-30 lg:block"
          viewBox="0 0 520 520"
          fill="none"
        >
          <path
            d="M10 470 C 140 470, 130 300, 260 300 S 390 130, 510 130"
            stroke="#08dc7d"
            strokeWidth="2.5"
            className="route-line"
          />
          <circle cx="10" cy="470" r="7" fill="#ffc8b2" />
          <circle cx="260" cy="300" r="7" fill="#ffdd64" />
          <circle cx="510" cy="130" r="7" fill="#00d7ff" />
        </svg>

        <header className="safe-top relative z-10 flex items-center gap-2.5 px-5 pb-3 pt-4 sm:gap-3 sm:p-8 lg:p-10">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream text-navy shadow-lift sm:h-11 sm:w-11 sm:rounded-2xl">
            <Gauge className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.4} />
          </span>
          <div>
            <p className="font-display text-base font-bold leading-none tracking-tight sm:text-lg">
              FleetPulse
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-cream/50 sm:text-[11px]">
              Meridian Group
            </p>
          </div>
        </header>

        <div className="relative z-10 flex flex-1 flex-col justify-center px-5 pb-5 sm:px-8 sm:pb-8 lg:px-10 lg:pb-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <Badge className="hidden border-green/40 bg-green/10 px-3 py-1 text-green normal-case tracking-[0.18em] sm:inline-flex">
              Corporate Fleet OS
            </Badge>
            <h1 className="font-display text-[27px] font-bold leading-[1.05] tracking-tight sm:mt-5 sm:text-5xl lg:mt-6 lg:text-6xl">
              Every kilometre,
              <br />
              <span className="text-peach">accounted for.</span>
            </h1>
            <p className="mt-3 hidden max-w-md text-[15px] leading-relaxed text-cream/65 sm:block lg:mt-5">
              One-tap driver logging, branch-level oversight and company-wide fuel
              intelligence — built for the 53 people who keep Meridian moving.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative mt-10 hidden max-w-md overflow-hidden rounded-3xl border border-cream/15 shadow-lift lg:block"
          >
            <Image
              src="/images/fleet-hero.jpg"
              alt="Meridian Group fleet"
              width={640}
              height={420}
              className="h-56 w-full object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-cream/60">Fleet readiness</p>
                <p className="font-display text-2xl font-bold">94% active today</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-green px-3 py-1 text-xs font-bold text-navy">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-navy" />
                LIVE
              </span>
            </div>
          </motion.div>
        </div>

        <div className="relative z-10 hidden overflow-hidden border-t border-cream/10 py-4 sm:block">
          <div className="flex w-max animate-marquee items-center gap-8 whitespace-nowrap">
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <span key={i} className="flex items-center gap-3 text-[13px] font-medium text-cream/55">
                <Route className="h-4 w-4 text-green" />
                {m}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------- Sign-in panel ---------------------------- */}
      <section className="flex flex-col bg-cream">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-7 sm:px-6 sm:py-10 lg:py-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            <div className="flex items-center gap-2 text-navy/60">
              <Lock className="h-4 w-4" />
              <p className="text-[11px] font-bold uppercase tracking-[0.22em]">Secure sign in</p>
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-navy sm:mt-3 sm:text-4xl">
              Welcome back
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft sm:text-sm">
              Sign in with your work email. Passwords are issued and reset by your
              fleet manager.
            </p>
          </motion.div>

          <motion.form
            onSubmit={signIn}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mt-5 space-y-3.5"
          >
            <div>
              <Label htmlFor="email">Work email</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/35" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@meridian-group.it"
                  className="h-12 rounded-xl bg-white pl-10 shadow-tactile"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1.5">
                <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/35" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Issued by your fleet manager"
                  className="h-12 rounded-xl bg-white pl-10 pr-12 shadow-tactile"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-navy/45 transition-colors hover:bg-navy/6 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2 rounded-xl border border-red/25 bg-red/8 px-3.5 py-2.5 text-[13px] font-semibold text-red"
                >
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              size="lg"
              disabled={submitting || !email || !password}
              className="w-full justify-between rounded-2xl"
            >
              <span className="flex items-center gap-2.5">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                {submitting ? "Signing in…" : "Sign in"}
              </span>
              <ArrowRight className="h-5 w-5" />
            </Button>

            <p className="flex items-start gap-2 rounded-xl bg-navy/4 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-soft">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy/35" />
              Forgot your password? Only the fleet manager can reset it — passwords
              cannot be changed by drivers or branch managers.
            </p>
          </motion.form>

          {demo.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 rounded-2xl border border-dashed border-navy/20 bg-white/60 p-3.5"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-navy/45">
                Demo accounts · tap to fill
              </p>
              <div className="mt-2 space-y-1.5">
                {demo.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => useDemo(d)}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-cream active:bg-cream cursor-pointer"
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                        d.role === "super_admin" && "bg-purple/12 text-purple",
                        d.role === "branch_manager" && "bg-blue/12 text-blue",
                        d.role === "driver" && "bg-green/15 text-green-deep"
                      )}
                    >
                      {d.role === "super_admin" ? "Admin" : d.role === "branch_manager" ? "Branch Manager" : "Driver"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-semibold text-navy">{d.email}</span>
                      <span className="block truncate font-mono text-[10px] text-ink-soft">{d.password}</span>
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Take-off overlay */}
      <AnimatePresence>
        {launching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-navy px-6 text-center text-cream"
          >
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="flex h-20 w-20 items-center justify-center rounded-3xl bg-green text-navy shadow-lift"
            >
              <Gauge className="h-10 w-10" strokeWidth={2.4} />
            </motion.span>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-6 font-display text-2xl font-bold"
            >
              Welcome back, {launching.split(" ")[0]}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-1 text-sm text-cream/60"
            >
              Routing you to your workspace…
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
