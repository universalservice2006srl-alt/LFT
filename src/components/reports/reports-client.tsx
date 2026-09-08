"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CarFront,
  CircleSlash,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Fuel,
  Loader2,
  RotateCcw,
  Route,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtEuro, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { authFetch, withToken } from "@/lib/session-client";
import type { VehicleDailyReport, VehicleDailyRow } from "@/lib/data";
import type { BranchDTO, SessionUserDTO } from "@/lib/types";

const STATUS_META: Record<
  VehicleDailyRow["status"],
  { label: string; cls: string }
> = {
  logged: { label: "Logged", cls: "bg-green/15 text-green-deep border-green/30" },
  partial: { label: "Incomplete", cls: "bg-yellow/30 text-[#8a6210] border-yellow/60" },
  not_used: { label: "Not used", cls: "bg-navy/8 text-navy/55 border-navy/15" },
};

/** dd MMM — locale-independent so server and client always match */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
function weekday(iso: string) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[new Date(`${iso}T12:00:00.000Z`).getUTCDay()];
}

export function ReportsClient({
  user,
  initial,
  branches,
}: {
  user: SessionUserDTO;
  initial: VehicleDailyReport;
  branches: BranchDTO[];
}) {
  const [report, setReport] = useState<VehicleDailyReport>(initial);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(initial.summary.from);
  const [to, setTo] = useState(initial.summary.to);
  const [branch, setBranch] = useState("all");
  const [q, setQ] = useState("");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canReview = user.role === "super_admin" || user.role === "branch_manager";

  /** Approve / flag every entry behind one vehicle-day row. */
  async function reviewRow(r: VehicleDailyRow, action: "approve" | "flag") {
    if (r.logIds.length === 0) return;
    const key = `${r.vehicleId}-${r.date}`;
    setRowBusy(key);
    try {
      const res = await authFetch("/api/logs/bulk-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: r.logIds, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update");
      setReport((prev) => ({
        ...prev,
        rows: prev.rows.map((x) =>
          x.vehicleId === r.vehicleId && x.date === r.date
            ? { ...x, reviewStatus: data.status }
            : x
        ),
      }));
      setNotice(
        `${action === "approve" ? "Approved" : "Flagged"} ${data.count} entr${
          data.count === 1 ? "y" : "ies"
        } · ${r.plate} ${shortDate(r.date)}`
      );
      setTimeout(() => setNotice(null), 3000);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not update");
      setTimeout(() => setNotice(null), 3500);
    } finally {
      setRowBusy(null);
    }
  }

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("from", from);
    sp.set("to", to);
    if (branch !== "all") sp.set("branch", branch);
    if (q.trim()) sp.set("q", q.trim());
    if (issuesOnly) sp.set("issues", "1");
    return sp.toString();
  }, [from, to, branch, q, issuesOnly]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/reports/vehicle-daily?${queryString}`);
      if (res.ok) setReport(await res.json());
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  const [first, setFirst] = useState(true);
  useEffect(() => {
    if (first) {
      setFirst(false);
      return;
    }
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const s = report.summary;

  const kpis = [
    {
      label: "Total mileage",
      value: `${fmtNumber(s.totalKm)} km`,
      sub: `${s.loggedDays} complete day logs`,
      icon: Route,
      cls: "bg-blue/12 text-blue",
    },
    {
      label: "Refuel spend",
      value: fmtEuro(s.totalCost),
      sub: `${fmtNumber(s.totalLiters)} litres total`,
      icon: Fuel,
      cls: "bg-green/15 text-green-deep",
    },
    {
      label: "Days not used",
      value: String(s.notUsedDays),
      sub: `${s.partialDays} incomplete logs`,
      icon: CircleSlash,
      cls: "bg-navy/8 text-navy/70",
    },
    {
      label: "Needs verification",
      value: String(s.mismatchDays),
      sub: s.unloggedKm > 0 ? `${fmtNumber(s.unloggedKm)} km unaccounted` : "No mileage gaps",
      icon: AlertTriangle,
      cls: s.mismatchDays > 0 ? "bg-red/10 text-red" : "bg-green/15 text-green-deep",
    },
  ];

  const resetFilters = () => {
    setBranch("all");
    setQ("");
    setIssuesOnly(false);
  };

  const exportHref = (format: string) =>
    withToken(`/api/reports/vehicle-daily?${queryString}&format=${format}`);

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      {/* ------------------------------ Header ------------------------------ */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-navy/45 sm:text-[11px] sm:tracking-[0.22em]">
            <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {user.role === "super_admin"
                ? "Company-wide verification"
                : `${user.branchName} branch verification`}
            </span>
          </p>
          <h1 className="mt-1.5 font-display text-[28px] font-bold leading-tight tracking-tight text-navy sm:mt-2 sm:text-3xl">
            Vehicle log report
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-soft sm:text-sm">
            Day-by-day reconciliation per vehicle. Unreported days are flagged and
            checked against the next odometer reading to catch mileage mismatches.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <Download className="h-4 w-4" /> Export report
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Download current view</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={exportHref("csv")}>
                <FileText className="h-4 w-4 text-blue" /> CSV (.csv)
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={exportHref("xls")}>
                <FileSpreadsheet className="h-4 w-4 text-green-deep" /> Excel (.xls)
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {notice && (
        <p className="flex items-start gap-2 rounded-xl border border-green/30 bg-green/10 px-3.5 py-2.5 text-[13px] font-semibold text-green-deep">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          {notice}
        </p>
      )}

      {/* ------------------------------- KPIs ------------------------------- */}
      <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="min-w-0 rounded-2xl p-3.5 sm:rounded-3xl sm:p-5">
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10",
                k.cls
              )}
            >
              <k.icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </span>
            <p className="mt-3 truncate font-display text-[clamp(1.15rem,5.5vw,1.6rem)] font-bold leading-none tracking-tight text-navy sm:mt-4 sm:text-3xl">
              {k.value}
            </p>
            <p className="mt-1.5 text-[11px] font-semibold leading-tight text-navy/70 sm:text-[13px]">
              {k.label}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-ink-soft/80 sm:text-[11px]">
              {k.sub}
            </p>
          </Card>
        ))}
      </div>

      {/* ------------------------------ Filters ------------------------------ */}
      <Card className="min-w-0 overflow-hidden rounded-2xl sm:rounded-3xl">
        <div className="space-y-3 border-b border-navy/8 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div>
              <Label htmlFor="from" className="text-[11px]">From</Label>
              <div className="relative mt-1.5">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/35" />
                <Input
                  id="from"
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-11 pl-9 text-[13px] sm:h-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="to" className="text-[11px]">To</Label>
              <div className="relative mt-1.5">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/35" />
                <Input
                  id="to"
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-11 pl-9 text-[13px] sm:h-10"
                />
              </div>
            </div>
            {user.role === "super_admin" ? (
              <div>
                <Label className="text-[11px]">Office</Label>
                <Select value={branch} onValueChange={setBranch}>
                  <SelectTrigger className="mt-1.5 h-11 text-[13px] sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All offices</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label className="text-[11px]">Office</Label>
                <div className="mt-1.5 flex h-11 items-center rounded-xl border-2 border-navy/10 bg-navy/4 px-3.5 text-[13px] font-semibold text-navy/70 sm:h-10">
                  {user.branchName}
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="q" className="text-[11px]">Vehicle or staff</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
                <Input
                  id="q"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Plate or name…"
                  className="h-11 pl-9 text-[13px] sm:h-10"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIssuesOnly((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer",
                issuesOnly
                  ? "bg-red/12 text-red ring-1 ring-red/30"
                  : "bg-navy/6 text-navy/55 hover:text-navy"
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Needs verification only
            </button>
            {(branch !== "all" || q || issuesOnly) && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 text-xs font-bold text-blue hover:underline cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            )}
            <span className="ml-auto text-[11px] font-semibold text-ink-soft">
              {loading ? "Loading…" : `${fmtNumber(s.rowCount)} rows · ${s.vehicles} vehicles · ${s.days} days`}
            </span>
          </div>
        </div>

        {/* --------------------------- Mobile cards --------------------------- */}
        <div className="space-y-2.5 p-3 lg:hidden">
          {loading &&
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}

          {!loading && report.rows.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-navy/15 px-4 py-10 text-center">
              <ShieldCheck className="mx-auto h-7 w-7 text-green-deep" />
              <p className="mt-2 text-sm font-semibold text-navy/70">
                Nothing to verify in this range.
              </p>
            </div>
          )}

          {!loading &&
            report.rows.map((r) => {
              const meta = STATUS_META[r.status];
              const key = `${r.vehicleId}-${r.date}`;
              return (
                <article
                  key={key}
                  className={cn(
                    "rounded-2xl border bg-white/80 p-3.5 shadow-tactile",
                    r.severity === "alert" ? "border-red/30" : "border-navy/8"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold tracking-wide text-navy">
                        {r.plate}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-ink-soft">
                        {shortDate(r.date)} · {weekday(r.date)} · {r.branchName}
                      </p>
                    </div>
                    <Badge className={cn("shrink-0 border", meta.cls)}>{meta.label}</Badge>
                  </div>

                  <p className="mt-2 truncate text-[11px] text-navy/60">
                    <span className="font-semibold text-navy/80">
                      {r.assignedStaff ?? "Pool vehicle"}
                    </span>
                    {r.loggedBy.length > 0 && r.loggedBy[0] !== r.assignedStaff && (
                      <> · logged by {r.loggedBy.join(", ")}</>
                    )}
                    {r.temporaryUse && (
                      <Badge variant="amber" className="ml-1.5 px-1.5 py-0 text-[9px]">Temp</Badge>
                    )}
                  </p>

                  <div className="mt-3 grid grid-cols-4 divide-x divide-navy/8 rounded-xl bg-cream py-2.5 text-center">
                    {[
                      { l: "Morning", v: r.morningKm != null ? fmtNumber(r.morningKm) : "—" },
                      { l: "Evening", v: r.eveningKm != null ? fmtNumber(r.eveningKm) : "—" },
                      { l: "Total km", v: r.totalKm != null ? fmtNumber(r.totalKm) : "—" },
                      {
                        l: "Refuel",
                        v: r.refuelCost > 0 ? `€${r.refuelCost.toFixed(0)}` : "—",
                      },
                    ].map((c) => (
                      <div key={c.l} className="min-w-0 px-1">
                        <p className="truncate font-mono text-[11px] font-bold text-navy">{c.v}</p>
                        <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-navy/40">
                          {c.l}
                        </p>
                      </div>
                    ))}
                  </div>

                  {r.refuelCount > 0 && (
                    <p className="mt-2 text-[10px] font-semibold text-green-deep">
                      {r.refuelCount} refuel{r.refuelCount > 1 ? "s" : ""} · {r.refuelLiters.toFixed(2)} L · €
                      {r.refuelCost.toFixed(2)}
                    </p>
                  )}

                  {r.mismatch && (
                    <p
                      className={cn(
                        "mt-2 flex items-start gap-1.5 rounded-xl px-2.5 py-2 text-[10px] font-semibold leading-relaxed",
                        r.severity === "alert"
                          ? "bg-red/8 text-red"
                          : "bg-navy/5 text-ink-soft"
                      )}
                    >
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      {r.mismatch}
                    </p>
                  )}

                  {canReview && r.logIds.length > 0 && (
                    <div className="mt-2.5 flex items-center gap-2 border-t border-navy/6 pt-2.5">
                      {r.reviewStatus && (
                        <Badge
                          className={cn(
                            "border",
                            r.reviewStatus === "approved" &&
                              "bg-green/15 text-green-deep border-green/30",
                            r.reviewStatus === "pending" &&
                              "bg-yellow/25 text-[#8a6210] border-yellow/60",
                            r.reviewStatus === "flagged" && "bg-red/10 text-red border-red/30"
                          )}
                        >
                          {r.reviewStatus}
                        </Badge>
                      )}
                      <div className="ml-auto flex gap-1.5">
                        {r.reviewStatus !== "approved" && (
                          <Button
                            variant="green"
                            size="sm"
                            className="h-9"
                            disabled={rowBusy === `${r.vehicleId}-${r.date}`}
                            onClick={() => reviewRow(r, "approve")}
                          >
                            {rowBusy === `${r.vehicleId}-${r.date}` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-3.5 w-3.5" />
                            )}
                            Approve
                          </Button>
                        )}
                        {r.reviewStatus !== "flagged" && (
                          <Button
                            variant="danger"
                            size="sm"
                            className="h-9"
                            disabled={rowBusy === `${r.vehicleId}-${r.date}`}
                            onClick={() => reviewRow(r, "flag")}
                          >
                            <AlertTriangle className="h-3.5 w-3.5" /> Flag
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
        </div>

        {/* --------------------------- Desktop table --------------------------- */}
        <div className="hidden overflow-x-auto lg:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-navy/[0.03]">
                <TableHead>Date</TableHead>
                <TableHead>Vehicle reg</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Assigned staff</TableHead>
                <TableHead className="text-right">Morning</TableHead>
                <TableHead className="text-right">Evening</TableHead>
                <TableHead className="text-right">Total km</TableHead>
                <TableHead className="text-right">Refuel €</TableHead>
                <TableHead className="text-right">Litres</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verification</TableHead>
                {canReview && <TableHead className="text-right">Review</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: canReview ? 12 : 11 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {!loading && report.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canReview ? 12 : 11} className="py-14 text-center">
                    <ShieldCheck className="mx-auto h-7 w-7 text-green-deep" />
                    <p className="mt-2 text-sm font-semibold text-navy/70">
                      Nothing to verify in this range.
                    </p>
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                report.rows.map((r) => {
                  const meta = STATUS_META[r.status];
                  const key = `${r.vehicleId}-${r.date}`;
                  return (
                    <TableRow
                      key={key}
                      className={cn(
                        r.severity === "alert" && "bg-red/[0.035]",
                        r.status === "not_used" && r.severity !== "alert" && "opacity-70"
                      )}
                      onClick={() => setExpanded(expanded === key ? null : key)}
                    >
                      <TableCell className="whitespace-nowrap">
                        <p className="text-[13px] font-semibold text-navy">{shortDate(r.date)}</p>
                        <p className="text-[10px] text-ink-soft">{weekday(r.date)}</p>
                      </TableCell>
                      <TableCell>
                        <p className="whitespace-nowrap font-mono text-[12px] font-bold text-navy">
                          {r.plate}
                        </p>
                        <p className="max-w-[130px] truncate text-[10px] text-ink-soft">
                          {r.vehicleLabel}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs font-semibold text-navy/65">
                        {r.branchName}
                      </TableCell>
                      <TableCell>
                        <p className="max-w-[150px] truncate text-[13px] font-semibold text-navy">
                          {r.assignedStaff ?? <span className="text-ink-soft">Pool vehicle</span>}
                        </p>
                        {r.loggedBy.length > 0 && (
                          <p className="max-w-[150px] truncate text-[10px] text-ink-soft">
                            {r.temporaryUse && (
                              <Badge variant="amber" className="mr-1 px-1 py-0 text-[8px]">Temp</Badge>
                            )}
                            {r.loggedBy.join(", ")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono text-[13px] font-semibold">
                        {r.morningKm != null ? fmtNumber(r.morningKm) : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono text-[13px] font-semibold">
                        {r.eveningKm != null ? fmtNumber(r.eveningKm) : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono text-[13px] font-bold text-navy">
                        {r.totalKm != null ? fmtNumber(r.totalKm) : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono text-[13px]">
                        {r.refuelCost > 0 ? (
                          <span className="font-bold text-green-deep">
                            {r.refuelCost.toFixed(2)}
                            {r.refuelCount > 1 && (
                              <span className="ml-1 text-[9px] text-ink-soft">×{r.refuelCount}</span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono text-[13px]">
                        {r.refuelLiters > 0 ? r.refuelLiters.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("border", meta.cls)}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        {r.mismatch ? (
                          <p
                            className={cn(
                              "flex items-start gap-1.5 text-[11px] font-semibold leading-snug",
                              r.severity === "alert" ? "text-red" : "text-ink-soft"
                            )}
                          >
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            {r.mismatch}
                          </p>
                        ) : r.status === "logged" ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-green-deep">
                            <ShieldCheck className="h-3 w-3" /> Verified
                          </span>
                        ) : (
                          <span className="text-[11px] text-ink-soft">—</span>
                        )}
                      </TableCell>
                      {canReview && (
                        <TableCell className="text-right">
                          {r.logIds.length === 0 ? (
                            <span className="text-[11px] text-ink-soft">—</span>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              {r.reviewStatus && (
                                <Badge
                                  className={cn(
                                    "border",
                                    r.reviewStatus === "approved" &&
                                      "bg-green/15 text-green-deep border-green/30",
                                    r.reviewStatus === "pending" &&
                                      "bg-yellow/25 text-[#8a6210] border-yellow/60",
                                    r.reviewStatus === "flagged" && "bg-red/10 text-red border-red/30"
                                  )}
                                >
                                  {r.reviewStatus}
                                </Badge>
                              )}
                              {r.reviewStatus !== "approved" && (
                                <Button
                                  variant="green"
                                  size="icon-sm"
                                  title="Approve this day"
                                  aria-label={`Approve ${r.plate} ${r.date}`}
                                  disabled={rowBusy === `${r.vehicleId}-${r.date}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    reviewRow(r, "approve");
                                  }}
                                >
                                  {rowBusy === `${r.vehicleId}-${r.date}` ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              )}
                              {r.reviewStatus !== "flagged" && (
                                <Button
                                  variant="danger"
                                  size="icon-sm"
                                  title="Flag this day"
                                  aria-label={`Flag ${r.plate} ${r.date}`}
                                  disabled={rowBusy === `${r.vehicleId}-${r.date}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    reviewRow(r, "flag");
                                  }}
                                >
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>

        {/* Footer totals */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-navy/8 px-4 py-3 sm:px-5">
          <p className="flex items-center gap-1.5 text-xs text-ink-soft">
            <CarFront className="h-3.5 w-3.5" />
            {s.from} → {s.to}
          </p>
          <p className="font-mono text-xs font-bold text-navy">
            {fmtNumber(s.totalKm)} km · {fmtEuro(s.totalCost)} · {fmtNumber(s.totalLiters)} L
          </p>
        </div>
      </Card>

      {loading && (
        <p className="flex items-center justify-center gap-2 text-xs font-semibold text-ink-soft">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Rebuilding report…
        </p>
      )}
    </div>
  );
}
