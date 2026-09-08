"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CarFront,
  Flag,
  Fuel,
  Loader2,
  PenLine,
  ScrollText,
  Search,
  ShieldCheck,
  Sunrise,
  Sunset,
  Trash2,
  TriangleAlert,
  UserRoundCog,
  UserRoundPlus,
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
import { Skeleton } from "@/components/ui/skeleton";
import { entryTypeLabel, purposeLabel, STATUS_STYLES } from "@/lib/constants";
import { fmtDateTime, fmtNumber, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/session-client";
import type { LogRow, SessionUserDTO } from "@/lib/types";

export type SerializedAuditRow = {
  id: string;
  action: string;
  entityType: string;
  details: string | null;
  actorName: string | null;
  branchName: string | null;
  createdAt: string;
};

const ACTION_META: Record<string, { icon: typeof PenLine; chip: string; label: string }> = {
  "log.created": { icon: PenLine, chip: "bg-blue/12 text-blue", label: "Log created" },
  "log.created.temporary": { icon: PenLine, chip: "bg-[#e8935e]/15 text-[#a95a1d]", label: "Temporary-driver log" },
  "log.created.on_behalf": { icon: UserRoundCog, chip: "bg-purple/10 text-purple", label: "Filed for driver" },
  "log.approved": { icon: BadgeCheck, chip: "bg-green/15 text-green-deep", label: "Log approved" },
  "log.flagged": { icon: Flag, chip: "bg-red/10 text-red", label: "Log flagged" },
  "log.reopened": { icon: ShieldCheck, chip: "bg-yellow/40 text-[#8a6210]", label: "Log reopened" },
  "log.edited": { icon: PenLine, chip: "bg-blue/12 text-blue", label: "Log edited" },
  "log.deleted": { icon: Trash2, chip: "bg-red/10 text-red", label: "Log deleted" },
  "vehicle.registered": { icon: CarFront, chip: "bg-purple/10 text-purple", label: "Vehicle registered" },
  "vehicle.updated": { icon: CarFront, chip: "bg-purple/10 text-purple", label: "Vehicle updated" },
  "vehicle.retired": { icon: CarFront, chip: "bg-yellow/40 text-[#8a6210]", label: "Vehicle retired" },
  "vehicle.deleted": { icon: Trash2, chip: "bg-red/10 text-red", label: "Vehicle deleted" },
  "user.created": { icon: UserRoundPlus, chip: "bg-cyan/15 text-[#047795]", label: "User created" },
  "policy.updated": { icon: ScrollText, chip: "bg-navy/8 text-navy", label: "Policy update" },
};

const TYPE_ICON = { morning: Sunrise, evening: Sunset, refuel: Fuel } as const;

export function AuditClient({
  user,
  rows,
}: {
  user: SessionUserDTO;
  rows: SerializedAuditRow[];
}) {
  const [tab, setTab] = useState<"trail" | "logs">("trail");
  const [q, setQ] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* --------------------------- driver log tab --------------------------- */
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logQ, setLogQ] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LogRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const sp = new URLSearchParams({ limit: "40", page: "1" });
      if (logQ.trim()) sp.set("q", logQ.trim());
      const res = await authFetch(`/api/logs?${sp.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.rows ?? []);
      }
    } finally {
      setLoadingLogs(false);
    }
  }, [logQ]);

  useEffect(() => {
    if (tab !== "logs") return;
    const t = setTimeout(loadLogs, logQ ? 300 : 0);
    return () => clearTimeout(t);
  }, [tab, loadLogs, logQ]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/api/logs/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete");
      setNotice(
        `Deleted ${entryTypeLabel(deleteTarget.entryType)} entry · ${deleteTarget.plate} · ${deleteTarget.driverName}`
      );
      setTimeout(() => setNotice(null), 4000);
      setDeleteTarget(null);
      loadLogs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  const filteredTrail = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.action.toLowerCase().includes(needle) ||
        (r.details ?? "").toLowerCase().includes(needle) ||
        (r.actorName ?? "").toLowerCase().includes(needle) ||
        (r.branchName ?? "").toLowerCase().includes(needle)
    );
  }, [rows, q]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-navy/45 sm:text-[11px] sm:tracking-[0.22em]">
          <ScrollText className="h-3.5 w-3.5" />
          {user.role === "super_admin" ? "System trail · all branches" : `${user.branchName} branch trail`}
        </p>
        <h1 className="mt-1.5 font-display text-[28px] font-bold tracking-tight text-navy sm:mt-2 sm:text-3xl">
          Audit log
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft sm:text-sm">
          Every submission, review and registry change — plus driver entries you can remove.
        </p>
      </div>

      {notice && (
        <p className="flex items-start gap-2 rounded-xl border border-green/30 bg-green/10 px-3.5 py-2.5 text-[13px] font-semibold text-green-deep">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          {notice}
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 rounded-xl bg-navy/6 p-1">
        {[
          { v: "trail", l: "Activity trail" },
          { v: "logs", l: "Driver log entries" },
        ].map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v as typeof tab)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all cursor-pointer",
              tab === t.v ? "bg-navy text-cream shadow" : "text-navy/55 hover:text-navy"
            )}
          >
            {t.l}
          </button>
        ))}
      </div>

      {/* ----------------------------- Trail ----------------------------- */}
      {tab === "trail" && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search actions, actors, plates…"
              className="pl-9"
            />
          </div>

          <div className="relative">
            <span className="absolute bottom-4 left-[22px] top-2 w-px bg-navy/10" aria-hidden />
            <div className="space-y-1.5">
              {filteredTrail.map((r) => {
                const meta = ACTION_META[r.action] ?? ACTION_META["log.created"];
                const Icon = meta.icon;
                return (
                  <div
                    key={r.id}
                    className="relative flex gap-4 rounded-2xl px-1 py-2.5 transition-colors hover:bg-white/70"
                  >
                    <span
                      className={cn(
                        "z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-4 border-cream",
                        meta.chip
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-navy">{meta.label}</p>
                        {r.branchName && (
                          <Badge variant="outline" className="text-[9px]">{r.branchName}</Badge>
                        )}
                      </div>
                      {r.details && (
                        <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{r.details}</p>
                      )}
                      <p className="mt-0.5 text-[11px] text-navy/40" suppressHydrationWarning>
                        {r.actorName ?? "System"} · {fmtDateTime(r.createdAt)}
                        {mounted ? ` (${timeAgo(r.createdAt)})` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
              {filteredTrail.length === 0 && (
                <p className="rounded-2xl border-2 border-dashed border-navy/15 p-10 text-center text-sm text-ink-soft">
                  No audit entries match &ldquo;{q}&rdquo;.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* -------------------------- Driver logs -------------------------- */}
      {tab === "logs" && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
            <Input
              value={logQ}
              onChange={(e) => setLogQ(e.target.value)}
              placeholder="Search driver, plate or model…"
              className="pl-9"
            />
          </div>

          <p className="text-[11px] text-ink-soft">
            {user.role === "super_admin"
              ? "Showing the 40 most recent entries company-wide."
              : `Showing the 40 most recent entries for ${user.branchName}.`}{" "}
            Deleting an entry re-syncs the vehicle odometer and is recorded above.
          </p>

          <Card className="divide-y divide-navy/6 overflow-hidden rounded-2xl sm:rounded-3xl">
            {loadingLogs &&
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-3.5">
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}

            {!loadingLogs && logs.length === 0 && (
              <p className="p-10 text-center text-sm text-ink-soft">No entries found.</p>
            )}

            {!loadingLogs &&
              logs.map((log) => {
                const Icon = TYPE_ICON[log.entryType];
                const st = STATUS_STYLES[log.status];
                return (
                  <div key={log.id} className="flex items-center gap-3 p-3 sm:px-4">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                        log.entryType === "morning" && "bg-yellow/35 text-[#8a6210]",
                        log.entryType === "evening" && "bg-purple/10 text-purple",
                        log.entryType === "refuel" && "bg-green/15 text-green-deep"
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <Avatar
                      name={log.driverName}
                      color={log.driverColor}
                      className="hidden h-8 w-8 shrink-0 sm:flex"
                      textClassName="text-[9px]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <p className="font-mono text-[13px] font-bold text-navy">{log.plate}</p>
                        <Badge className={cn("border", st.className)}>{st.label}</Badge>
                        {log.isTemporaryDriver && (
                          <Badge variant="amber" className="px-1.5 py-0 text-[9px]">
                            {purposeLabel(log.tripPurpose)}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-ink-soft">
                        {log.driverName} · {entryTypeLabel(log.entryType)} ·{" "}
                        {fmtNumber(log.odometerValue)} km · {log.branchName}
                      </p>
                      <p className="truncate text-[10px] text-navy/40">{fmtDateTime(log.createdAt)}</p>
                    </div>
                    <Button
                      variant="danger"
                      size="icon"
                      title="Delete this entry"
                      aria-label={`Delete ${log.plate} entry`}
                      onClick={() => {
                        setDeleteTarget(log);
                        setError(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
          </Card>
        </>
      )}

      {/* --------------------------- Delete dialog --------------------------- */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-red" /> Delete this driver entry?
            </DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  {entryTypeLabel(deleteTarget.entryType)} · {deleteTarget.plate} ·{" "}
                  {fmtNumber(deleteTarget.odometerValue)} km, submitted by{" "}
                  {deleteTarget.driverName}. The record is removed permanently
                  {deleteTarget.refuel ? " along with its refuel data" : ""} and the
                  vehicle odometer is recalculated.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="rounded-xl bg-red/10 px-3.5 py-2.5 text-sm font-semibold text-red">{error}</p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
