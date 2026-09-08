"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LockOpen,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  UserRoundX,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CredentialBox } from "@/components/shared/credential-box";
import { ROLE_LABELS } from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/session-client";
import type { SecurityAccount, SecurityOverview } from "@/lib/data";
import type { SessionUserDTO } from "@/lib/types";

export type SerializedEvent = {
  id: string;
  action: string;
  details: string | null;
  actorName: string | null;
  createdAt: string;
};

const EVENT_LABEL: Record<string, { label: string; cls: string }> = {
  "user.created": { label: "Account created", cls: "bg-cyan/15 text-[#047795]" },
  "user.updated": { label: "Account updated", cls: "bg-blue/12 text-blue" },
  "user.deleted": { label: "Account deleted", cls: "bg-red/10 text-red" },
  "user.activated": { label: "Reactivated", cls: "bg-green/15 text-green-deep" },
  "user.deactivated": { label: "Deactivated", cls: "bg-[#e8935e]/15 text-[#a95a1d]" },
  "user.unlocked": { label: "Lockout cleared", cls: "bg-green/15 text-green-deep" },
  "user.password_reset": { label: "Password reset", cls: "bg-purple/10 text-purple" },
  "user.password_viewed": { label: "Credentials viewed", cls: "bg-yellow/35 text-[#8a6210]" },
  "account.password_changed": { label: "Own password changed", cls: "bg-navy/8 text-navy" },
};

export function SecurityClient({
  user,
  accounts,
  stats,
  events,
}: {
  user: SessionUserDTO;
  accounts: SecurityAccount[];
  stats: SecurityOverview["stats"];
  events: SerializedEvent[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "locked" | "inactive" | "never">("all");
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [credential, setCredential] = useState<{
    title: string;
    email: string;
    password: string;
    setAt?: string;
  } | null>(null);

  const now = Date.now();
  const isLocked = (a: SecurityAccount) =>
    !!a.lockedUntil && new Date(a.lockedUntil).getTime() > now;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return accounts.filter((a) => {
      if (filter === "locked" && !isLocked(a)) return false;
      if (filter === "inactive" && a.isActive) return false;
      if (filter === "never" && !a.neverLoggedIn) return false;
      if (!needle) return true;
      return (
        a.fullName.toLowerCase().includes(needle) ||
        a.email.toLowerCase().includes(needle) ||
        (a.branchName ?? "").toLowerCase().includes(needle)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, q, filter]);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwBusy(true);
    setPwError(null);
    try {
      const res = await authFetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: current,
          newPassword: next,
          confirmPassword: confirm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not change password");
      setCurrent("");
      setNext("");
      setConfirm("");
      setPwDone(true);
      setTimeout(() => setPwDone(false), 4000);
      startTransition(() => router.refresh());
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setPwBusy(false);
    }
  }

  async function unlock(a: SecurityAccount) {
    setRowBusy(a.id);
    try {
      const res = await authFetch("/api/security/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: a.id }),
      });
      if (res.ok) {
        setNotice(`Lockout cleared for ${a.fullName}`);
        setTimeout(() => setNotice(null), 2800);
        startTransition(() => router.refresh());
      }
    } finally {
      setRowBusy(null);
    }
  }

  /** Fetch and reveal any account's current credentials (super admin only). */
  async function viewPassword(a: SecurityAccount) {
    setRowBusy(a.id);
    try {
      const res = await authFetch(`/api/users/${a.id}/password`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setCredential({
        title: `Credentials for ${data.fullName}`,
        email: data.email,
        password: data.password ?? "— not available, generate a new one —",
        setAt: data.passwordSetAt,
      });
    } catch {
      setNotice("Could not load credentials");
      setTimeout(() => setNotice(null), 2800);
    } finally {
      setRowBusy(null);
    }
  }

  const kpis = [
    { label: "Active accounts", value: stats.active, icon: ShieldCheck, cls: "bg-green/15 text-green-deep" },
    { label: "Locked out", value: stats.locked, icon: Lock, cls: "bg-red/10 text-red" },
    { label: "Never signed in", value: stats.neverLoggedIn, icon: Clock, cls: "bg-yellow/35 text-[#8a6210]" },
    { label: "Deactivated", value: stats.deactivated, icon: UserRoundX, cls: "bg-navy/8 text-navy/70" },
  ];

  return (
    <div className="min-w-0 space-y-5">
      {/* Header */}
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-navy/45 sm:text-[11px] sm:tracking-[0.22em]">
          <Shield className="h-3.5 w-3.5" /> Fleet manager · security portal
        </p>
        <h1 className="mt-1.5 font-display text-[28px] font-bold tracking-tight text-navy sm:mt-2 sm:text-3xl">
          Security
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft sm:text-sm">
          Credential health across all {stats.total} accounts, plus your own password.
        </p>
      </div>

      {notice && (
        <p className="flex items-start gap-2 rounded-xl border border-green/30 bg-green/10 px-3.5 py-2.5 text-[13px] font-semibold text-green-deep">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          {notice}
        </p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="min-w-0 rounded-2xl p-3.5 sm:rounded-3xl sm:p-5">
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10", k.cls)}>
              <k.icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </span>
            <p className="mt-3 font-display text-[clamp(1.3rem,6vw,1.75rem)] font-bold leading-none text-navy sm:mt-4 sm:text-3xl">
              {k.value}
            </p>
            <p className="mt-1.5 text-[11px] font-semibold leading-tight text-navy/70 sm:text-[13px]">
              {k.label}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        {/* ------------------------ Own password ------------------------ */}
        <Card className="min-w-0 rounded-2xl p-4 sm:rounded-3xl sm:p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple/10 text-purple">
              <KeyRound className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-navy">Change my password</h2>
              <p className="text-[11px] text-ink-soft">{user.email}</p>
            </div>
          </div>

          <form onSubmit={changePassword} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="cur">Current password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="cur"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  className="pr-11 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide passwords" : "Show passwords"}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-navy/45 hover:bg-navy/6 cursor-pointer"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="new">New password</Label>
              <Input
                id="new"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="Min 8 chars, letter + number"
                className="mt-1.5 font-mono"
                required
              />
            </div>
            <div>
              <Label htmlFor="conf">Confirm new password</Label>
              <Input
                id="conf"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1.5 font-mono"
                required
              />
              {confirm && next !== confirm && (
                <p className="mt-1.5 text-[11px] font-semibold text-red">Passwords do not match</p>
              )}
            </div>

            {pwError && (
              <p className="flex items-start gap-2 rounded-xl border border-red/25 bg-red/8 px-3.5 py-2.5 text-[13px] font-semibold text-red">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {pwError}
              </p>
            )}
            {pwDone && (
              <p className="flex items-start gap-2 rounded-xl border border-green/30 bg-green/10 px-3.5 py-2.5 text-[13px] font-semibold text-green-deep">
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                Password updated. Use it at your next sign-in.
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={pwBusy || !current || !next || next !== confirm}
            >
              {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Update password
            </Button>
          </form>

          <p className="mt-3 flex items-start gap-2 rounded-xl bg-navy/4 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-soft">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy/35" />
            Only fleet managers can change their own password. Drivers and branch
            managers are reset from the People page.
          </p>
        </Card>

        {/* ------------------------ Account inventory ------------------------ */}
        <Card className="min-w-0 overflow-hidden rounded-2xl sm:rounded-3xl">
          <div className="border-b border-navy/8 p-4 sm:p-5">
            <h2 className="font-display text-base font-bold text-navy">Account credentials</h2>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email or branch…"
                className="pl-9"
              />
            </div>
            <div className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">
              {[
                { v: "all", l: `All (${stats.total})` },
                { v: "locked", l: `Locked (${stats.locked})` },
                { v: "never", l: `Never signed in (${stats.neverLoggedIn})` },
                { v: "inactive", l: `Deactivated (${stats.deactivated})` },
              ].map((f) => (
                <button
                  key={f.v}
                  onClick={() => setFilter(f.v as typeof filter)}
                  className={cn(
                    "shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold transition-all cursor-pointer",
                    filter === f.v ? "bg-navy text-cream shadow" : "bg-navy/6 text-navy/55"
                  )}
                >
                  {f.l}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[520px] divide-y divide-navy/6 overflow-y-auto">
            {filtered.map((a) => {
              const locked = isLocked(a);
              return (
                <div key={a.id} className="flex items-center gap-3 p-3 sm:px-5">
                  <Avatar name={a.fullName} color={a.avatarColor} className="h-9 w-9 shrink-0 rounded-xl" textClassName="text-[10px]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <p className="truncate text-[13px] font-bold text-navy">{a.fullName}</p>
                      {a.id === user.id && <Badge variant="outline" className="text-[9px]">You</Badge>}
                      {locked && <Badge variant="red" className="text-[9px]">Locked</Badge>}
                      {!a.isActive && <Badge variant="amber" className="text-[9px]">Off</Badge>}
                    </div>
                    <p className="truncate text-[11px] text-ink-soft">{a.email}</p>
                    <p className="mt-0.5 truncate text-[10px] text-navy/45">
                      {ROLE_LABELS[a.role]}
                      {a.branchName ? ` · ${a.branchName}` : ""} · pw set {fmtDate(a.passwordSetAt)}
                      {a.passwordSetByName ? ` by ${a.passwordSetByName.split(" ")[0]}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-navy/40">
                      Last sign-in
                    </p>
                    <p className={cn("text-[11px] font-semibold", a.neverLoggedIn ? "text-[#a95a1d]" : "text-navy")}>
                      {a.lastLoginAt ? fmtDate(a.lastLoginAt) : "Never"}
                    </p>
                    {a.failedAttempts > 0 && (
                      <p className="text-[10px] font-bold text-red">{a.failedAttempts} failed</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => viewPassword(a)}
                      disabled={rowBusy === a.id}
                      title="View credentials"
                      aria-label={`View credentials for ${a.fullName}`}
                      className="text-navy/45 hover:text-blue"
                    >
                      {rowBusy === a.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    {(locked || a.failedAttempts > 0) && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => unlock(a)}
                        disabled={rowBusy === a.id}
                        title="Clear lockout"
                        aria-label="Clear lockout"
                      >
                        <LockOpen className="h-4 w-4 text-green-deep" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="p-10 text-center text-sm text-ink-soft">No accounts match.</p>
            )}
          </div>
        </Card>
      </div>

      {/* ------------------------ Security events ------------------------ */}
      <Card className="min-w-0 overflow-hidden rounded-2xl sm:rounded-3xl">
        <div className="flex items-center gap-2.5 border-b border-navy/8 p-4 sm:p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red/10 text-red">
            <ShieldAlert className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-navy">Security events</h2>
            <p className="text-[11px] text-ink-soft">
              Account and credential activity across the company
            </p>
          </div>
        </div>
        <div className="max-h-[420px] divide-y divide-navy/6 overflow-y-auto">
          {events.map((e) => {
            const meta = EVENT_LABEL[e.action] ?? { label: e.action, cls: "bg-navy/8 text-navy" };
            return (
              <div key={e.id} className="flex items-start gap-3 p-3 sm:px-5">
                <span className={cn("mt-0.5 shrink-0 rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-wide", meta.cls)}>
                  {meta.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-navy">{e.details}</p>
                  <p className="text-[10px] text-navy/45">
                    {e.actorName ?? "System"} · {fmtDateTime(e.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
          {events.length === 0 && (
            <p className="p-10 text-center text-sm text-ink-soft">No security events recorded.</p>
          )}
        </div>
      </Card>

      {/* --------------------- Credential viewer --------------------- */}
      <Dialog open={!!credential} onOpenChange={(o) => !o && setCredential(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{credential?.title}</DialogTitle>
            <DialogDescription>
              {credential?.setAt
                ? `Password last set ${fmtDate(credential.setAt)}. Every view is recorded in the audit log.`
                : "Save these credentials now."}
            </DialogDescription>
          </DialogHeader>
          {credential && (
            <CredentialBox
              email={credential.email}
              password={credential.password}
              footnote="Only you (fleet manager) can view or reset credentials."
            />
          )}
          <DialogFooter>
            <Button onClick={() => setCredential(null)}>
              <Check className="h-4 w-4" /> Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
