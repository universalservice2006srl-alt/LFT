"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Flag,
  Fuel,
  ImageOff,
  Loader2,
  MapPin,
  Pencil,
  RotateCcw,
  Search,
  ShieldCheck,
  Sunrise,
  Sunset,
  Trash2,
  TriangleAlert,
  UserRoundCog,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { DialogFooter } from "@/components/ui/dialog";
import { TRIP_PURPOSES } from "@/lib/constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { APPROVER_LABEL, entryTypeLabel, purposeLabel, STATUS_STYLES } from "@/lib/constants";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { authFetch, withToken } from "@/lib/session-client";
import { ManualLogDialog } from "@/components/dashboard/manual-log-dialog";
import type { BranchDTO, LogRow, SessionUserDTO } from "@/lib/types";

const TYPE_ICON = { morning: Sunrise, evening: Sunset, refuel: Fuel } as const;
const TYPE_STYLE = {
  morning: "bg-yellow/35 text-[#8a6210]",
  evening: "bg-purple/10 text-purple",
  refuel: "bg-green/15 text-green-deep",
} as const;

type Filters = {
  branch: string;
  type: string;
  usage: string;
  status: string;
  q: string;
};

export function LogsExplorer({
  user,
  branches,
}: {
  user: SessionUserDTO;
  branches: BranchDTO[];
}) {
  const [filters, setFilters] = useState<Filters>({
    branch: user.role === "branch_manager" && user.branchId ? user.branchId : "all",
    type: "all",
    usage: "all",
    status: "all",
    q: "",
  });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<LogRow | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<LogRow | null>(null);
  const [editForm, setEditForm] = useState({
    entryType: "morning",
    odometerValue: "",
    distanceKm: "",
    status: "pending",
    isTemporaryDriver: false,
    tripPurpose: "",
    note: "",
    liters: "",
    totalCost: "",
    stationName: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<LogRow | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Fleet managers and local office managers can both edit / delete entries;
  // the API additionally scopes office managers to their own branch.
  const canManage = user.role === "super_admin" || user.role === "branch_manager";
  const isAdmin = canManage;

  function openEdit(log: LogRow) {
    setEditTarget(log);
    setDialogError(null);
    setEditForm({
      entryType: log.entryType,
      odometerValue: String(log.odometerValue),
      distanceKm: String(log.distanceKm),
      status: log.status,
      isTemporaryDriver: log.isTemporaryDriver,
      tripPurpose: log.tripPurpose ?? "",
      note: log.note ?? "",
      liters: log.refuel?.liters ?? "",
      totalCost: log.refuel?.totalCost ?? "",
      stationName: log.refuel?.stationName ?? "",
    });
  }

  async function saveEdit() {
    if (!editTarget) return;
    setDialogBusy(true);
    setDialogError(null);
    try {
      const res = await authFetch(`/api/logs/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          entryType: editForm.entryType,
          odometerValue: Number(editForm.odometerValue),
          distanceKm: Number(editForm.distanceKm),
          status: editForm.status,
          isTemporaryDriver: editForm.isTemporaryDriver,
          tripPurpose: editForm.isTemporaryDriver ? editForm.tripPurpose || null : null,
          note: editForm.note,
          refuel:
            editForm.entryType === "refuel" && editForm.liters && editForm.totalCost
              ? {
                  liters: Number(editForm.liters),
                  totalCost: Number(editForm.totalCost),
                  stationName: editForm.stationName || null,
                }
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setEditTarget(null);
      load();
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setDialogBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDialogBusy(true);
    setDialogError(null);
    try {
      const res = await authFetch(`/api/logs/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete");
      setDeleteTarget(null);
      setPreview(null);
      load();
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setDialogBusy(false);
    }
  }

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (filters.branch !== "all") sp.set("branch", filters.branch);
    if (filters.type !== "all") sp.set("type", filters.type);
    if (filters.usage !== "all") sp.set("usage", filters.usage);
    if (filters.status !== "all") sp.set("status", filters.status);
    if (filters.q.trim()) sp.set("q", filters.q.trim());
    sp.set("page", String(page));
    sp.set("limit", "14");
    return sp.toString();
  }, [filters, page]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/logs?${queryString}`);
      const data = await res.json();
      if (res.ok) {
        setRows(data.rows);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    const t = setTimeout(load, filters.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, filters.q]);

  const set = (k: keyof Filters, v: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [k]: v }));
  };

  const resetFilters = () =>
    setFilters({
      branch: user.role === "branch_manager" && user.branchId ? user.branchId : "all",
      type: "all",
      usage: "all",
      status: "all",
      q: "",
    });

  async function review(log: LogRow, action: "approve" | "flag" | "reopen") {
    setActionBusy(log.id);
    try {
      const res = await authFetch(`/api/logs/${log.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const { status, reviewerName, reviewerRole, reviewedAt } = await res.json();
        const patch = { status, reviewerName, reviewerRole, reviewedAt };
        setRows((rs) => rs.map((r) => (r.id === log.id ? { ...r, ...patch } : r)));
        setPreview((p) => (p && p.id === log.id ? { ...p, ...patch } : p));
      }
    } finally {
      setActionBusy(null);
    }
  }

  const exportHref = (format: string) => {
    const sp = new URLSearchParams(queryString);
    sp.delete("page");
    sp.delete("limit");
    sp.set("format", format);
    return withToken(`/api/export?${sp.toString()}`);
  };

  return (
    <Card className="overflow-hidden rounded-2xl sm:rounded-3xl">
      {/* Filter bar */}
      <div className="space-y-3 border-b border-navy/8 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-navy/45">
            Mileage log explorer
          </p>
          <div className="flex items-center gap-2">
            {canManage && (
              <Button size="sm" onClick={() => setManualOpen(true)}>
                <UserRoundCog className="h-4 w-4" /> Record for driver
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4" /> Export
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
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <div className="relative col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
            <Input
              value={filters.q}
              onChange={(e) => set("q", e.target.value)}
              placeholder="Driver, plate or model…"
              className="h-11 pl-9 text-[13px] sm:h-10"
            />
          </div>
          {user.role === "super_admin" ? (
            <Select value={filters.branch} onValueChange={(v) => set("branch", v)}>
              <SelectTrigger className="h-11 text-[13px] sm:h-10">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex h-11 items-center rounded-xl border-2 border-navy/10 bg-navy/4 px-3.5 text-[13px] font-semibold text-navy/70 sm:h-10">
              {user.branchName} branch
            </div>
          )}
          <Select value={filters.type} onValueChange={(v) => set("type", v)}>
            <SelectTrigger className="h-10 text-[13px]">
              <SelectValue placeholder="Entry type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="morning">Morning start</SelectItem>
              <SelectItem value="evening">Evening end</SelectItem>
              <SelectItem value="refuel">Refuel</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.usage} onValueChange={(v) => set("usage", v)}>
            <SelectTrigger className="h-11 text-[13px] sm:h-10">
              <SelectValue placeholder="Usage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Assigned + temp</SelectItem>
              <SelectItem value="assigned">Assigned driver</SelectItem>
              <SelectItem value="temporary">Temporary driver</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger className="h-10 text-[13px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="flagged">Flagged</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(filters.q || filters.type !== "all" || filters.usage !== "all" || filters.status !== "all" || (user.role === "super_admin" && filters.branch !== "all")) && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 text-xs font-bold text-blue hover:underline cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" /> Reset filters
          </button>
        )}
      </div>

      {notice && (
        <p className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-green/30 bg-green/10 px-3.5 py-2.5 text-[13px] font-semibold text-green-deep sm:mx-5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          {notice}
        </p>
      )}

      {/* Mobile log cards — avoids a wide horizontally scrolling table */}
      <div className="space-y-2.5 p-3 lg:hidden">
        {loading &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-navy/8 bg-white/70 p-3.5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </div>
            </div>
          ))}

        {!loading && rows.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-navy/15 px-4 py-10 text-center">
            <p className="text-sm font-semibold text-navy/60">No logs match these filters.</p>
            <button onClick={resetFilters} className="mt-1 text-xs font-bold text-blue active:opacity-60">
              Clear all filters
            </button>
          </div>
        )}

        {!loading &&
          rows.map((log) => {
            const TypeIcon = TYPE_ICON[log.entryType];
            const st = STATUS_STYLES[log.status];
            const hasPhotos = !!(log.photoUrl || log.refuel?.receiptUrl);
            return (
              <article key={log.id} className="rounded-2xl border border-navy/8 bg-white/80 p-3.5 shadow-tactile">
                <div className="flex items-start gap-3">
                  <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TYPE_STYLE[log.entryType])}>
                    <TypeIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate font-mono text-sm font-bold tracking-wide text-navy">{log.plate}</p>
                      {log.isTemporaryDriver && <Badge variant="amber" className="px-1.5 py-0 text-[9px]">Temporary</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-soft">
                      {log.vehicleLabel} · {entryTypeLabel(log.entryType)}
                    </p>
                  </div>
                  <Badge className={cn("shrink-0 border", st.className)}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
                    {st.label}
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-3 divide-x divide-navy/8 rounded-xl bg-cream px-1 py-2.5 text-center">
                  <div className="min-w-0 px-1">
                    <p className="truncate font-mono text-xs font-bold text-navy">{fmtNumber(log.odometerValue)}</p>
                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-navy/40">Odometer</p>
                  </div>
                  <div className="min-w-0 px-1">
                    <p className="truncate font-mono text-xs font-bold text-navy">
                      {log.distanceKm > 0 ? `+${fmtNumber(log.distanceKm)}` : "—"}
                    </p>
                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-navy/40">Distance</p>
                  </div>
                  <div className="min-w-0 px-1">
                    <p className="truncate text-xs font-bold text-navy">{log.branchName}</p>
                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-navy/40">Branch</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Avatar name={log.driverName} color={log.driverColor} className="h-7 w-7" textClassName="text-[9px]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-navy">{log.driverName}</p>
                    <p className="truncate text-[10px] text-ink-soft">
                      {fmtDateTime(log.createdAt)}
                      {log.isTemporaryDriver ? ` · ${purposeLabel(log.tripPurpose)}` : ""}
                    </p>
                  </div>
                  {hasPhotos && (
                    <Button variant="ghost" size="icon" onClick={() => setPreview(log)} aria-label="View proof">
                      <Eye className="h-4 w-4 text-blue" />
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={actionBusy === log.id} className="h-10 px-3">
                        {actionBusy === log.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Review"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>{APPROVER_LABEL}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => review(log, "approve")} disabled={log.status === "approved"}>
                        <ShieldCheck className="h-4 w-4 text-green-deep" /> Approve
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => review(log, "flag")} disabled={log.status === "flagged"}>
                        <Flag className="h-4 w-4 text-red" /> Flag for audit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => review(log, "reopen")} disabled={log.status === "pending"}>
                        <RotateCcw className="h-4 w-4 text-blue" /> Reopen
                      </DropdownMenuItem>
                      {isAdmin && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEdit(log)}>
                            <Pencil className="h-4 w-4 text-blue" /> Edit entry
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteTarget(log)}>
                            <Trash2 className="h-4 w-4 text-red" /> Delete entry
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {log.reviewerName && (
                  <p className="mt-2 border-t border-navy/6 pt-2 text-[10px] font-semibold text-green-deep">
                    {st.label} by {log.reviewerName} · {log.reviewerRole === "super_admin" ? "Fleet manager" : "Local office manager"}
                  </p>
                )}
              </article>
            );
          })}
      </div>

      {/* Full data table for tablet / desktop */}
      <div className="hidden overflow-x-auto lg:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-navy/[0.03]">
              <TableHead>When</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead className="hidden xl:table-cell">Branch</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Odometer</TableHead>
              <TableHead className="hidden md:table-cell text-right">Dist.</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Proof</TableHead>
              <TableHead className="text-right">Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 7 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 11 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="py-14 text-center">
                  <p className="text-sm font-semibold text-navy/60">No logs match these filters.</p>
                  <button onClick={resetFilters} className="mt-1 text-xs font-bold text-blue hover:underline cursor-pointer">
                    Clear all filters
                  </button>
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              rows.map((log) => {
                const TypeIcon = TYPE_ICON[log.entryType];
                const st = STATUS_STYLES[log.status];
                const hasPhotos = !!(log.photoUrl || log.refuel?.receiptUrl);
                return (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs text-ink-soft">
                      {fmtDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <Avatar name={log.driverName} color={log.driverColor} className="h-7 w-7" textClassName="text-[9px]" />
                        <span className="max-w-[120px] truncate text-[13px] font-semibold">{log.driverName}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="font-mono text-[12px] font-bold whitespace-nowrap">{log.plate}</p>
                      <p className="max-w-[120px] truncate text-[11px] text-ink-soft">{log.vehicleLabel}</p>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-xs font-semibold text-navy/60">
                      {log.branchName}
                    </TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold", TYPE_STYLE[log.entryType])}>
                        <TypeIcon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{entryTypeLabel(log.entryType)}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-[13px] font-bold whitespace-nowrap">
                      {fmtNumber(log.odometerValue)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right font-mono text-xs text-ink-soft">
                      {log.distanceKm > 0 ? `+${fmtNumber(log.distanceKm)}` : "—"}
                    </TableCell>
                    <TableCell>
                      {log.isTemporaryDriver ? (
                        <span className="inline-flex flex-col gap-0.5">
                          <Badge variant="amber">Temporary</Badge>
                          <span className="text-[10px] font-semibold text-[#a95a1d]">
                            {purposeLabel(log.tripPurpose)}
                          </span>
                        </span>
                      ) : (
                        <Badge variant="blue">Assigned</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border", st.className)}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
                        {st.label}
                      </Badge>
                      {log.reviewerName && (
                        <p className="mt-1 max-w-[130px] truncate text-[10px] font-semibold text-ink-soft/80">
                          by {log.reviewerName}
                          {log.reviewerRole === "super_admin" ? " · Fleet" : " · Office"}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {hasPhotos ? (
                        <Button variant="ghost" size="icon-sm" onClick={() => setPreview(log)} title="Preview images">
                          <Eye className="h-4 w-4 text-blue" />
                        </Button>
                      ) : (
                        <span title="No photo attached">
                          <ImageOff className="mx-auto h-4 w-4 text-navy/20" />
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" disabled={actionBusy === log.id} className="h-8">
                            {actionBusy === log.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Review"
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>
                            Set status
                            <span className="mt-0.5 block text-[10px] font-semibold normal-case tracking-normal text-ink-soft/70">
                              {APPROVER_LABEL}
                            </span>
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => review(log, "approve")} disabled={log.status === "approved"}>
                            <ShieldCheck className="h-4 w-4 text-green-deep" /> Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => review(log, "flag")} disabled={log.status === "flagged"}>
                            <Flag className="h-4 w-4 text-red" /> Flag for audit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => review(log, "reopen")} disabled={log.status === "pending"}>
                            <RotateCcw className="h-4 w-4 text-blue" /> Reopen as pending
                          </DropdownMenuItem>
                          {isAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openEdit(log)}>
                                <Pencil className="h-4 w-4 text-blue" /> Edit entry
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeleteTarget(log)}>
                                <Trash2 className="h-4 w-4 text-red" /> Delete entry
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-navy/8 px-4 py-3 sm:px-5">
        <p className="text-xs text-ink-soft">
          <span className="font-bold text-navy">{fmtNumber(total)}</span> entries · page {page} of {totalPages}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ---------------------- Proof preview dialog ---------------------- */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono">{preview.plate}</span>
                  <Badge className={cn("border", STATUS_STYLES[preview.status].className)}>
                    {STATUS_STYLES[preview.status].label}
                  </Badge>
                  {preview.isTemporaryDriver && <Badge variant="amber">Temporary · {purposeLabel(preview.tripPurpose)}</Badge>}
                </DialogTitle>
                <DialogDescription>
                  {entryTypeLabel(preview.entryType)} by {preview.driverName} · {fmtDateTime(preview.createdAt)} ·{" "}
                  {fmtNumber(preview.odometerValue)} km
                  {preview.locationLat && preview.locationLng && (
                    <span className="mt-0.5 flex items-center gap-1 text-blue">
                      <MapPin className="h-3 w-3" />
                      {Number(preview.locationLat).toFixed(4)}, {Number(preview.locationLng).toFixed(4)}
                    </span>
                  )}
                  {preview.reviewerName && preview.reviewedAt && (
                    <span className="mt-1 flex items-center gap-1.5 font-semibold text-green-deep">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {STATUS_STYLES[preview.status].label} by {preview.reviewerName} (
                      {preview.reviewerRole === "super_admin" ? "fleet manager" : "local office manager"}) ·{" "}
                      {fmtDateTime(preview.reviewedAt)}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className={cn("grid gap-3", preview.refuel?.receiptUrl && preview.photoUrl ? "sm:grid-cols-2" : "grid-cols-1")}>
                {preview.photoUrl ? (
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview.photoUrl} alt="Odometer" className="max-h-[46dvh] w-full rounded-2xl border border-navy/10 object-contain bg-navy" />
                    <figcaption className="mt-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                      Odometer snap
                    </figcaption>
                  </figure>
                ) : (
                  <p className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-navy/15 p-8 text-sm text-ink-soft">
                    <ImageOff className="h-4 w-4" /> Photo capture is currently disabled
                  </p>
                )}
                {preview.refuel?.receiptUrl && (
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview.refuel.receiptUrl} alt="Receipt" className="max-h-[46dvh] w-full rounded-2xl border border-navy/10 object-contain bg-cream" />
                    <figcaption className="mt-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                      Receipt · {preview.refuel.liters} L · €{preview.refuel.totalCost}
                      {preview.refuel.stationName ? ` · ${preview.refuel.stationName}` : ""}
                    </figcaption>
                  </figure>
                )}
              </div>

              {preview.refuel && (
                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/70 p-3 text-center">
                  <div>
                    <p className="font-mono text-base font-bold text-navy">{preview.refuel.liters} L</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-navy/40">Litres</p>
                  </div>
                  <div>
                    <p className="font-mono text-base font-bold text-navy">€{preview.refuel.totalCost}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-navy/40">Total cost</p>
                  </div>
                  <div>
                    <p className="font-mono text-base font-bold text-navy">
                      {preview.refuel.stationName ?? "—"}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-navy/40">Station</p>
                  </div>
                </div>
              )}

              {preview.note && (
                <p className="rounded-xl bg-yellow/25 px-4 py-2.5 text-xs font-semibold text-[#7c5a08]">{preview.note}</p>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => review(preview, "reopen")} disabled={preview.status === "pending"}>
                  <RotateCcw className="h-3.5 w-3.5" /> Reopen
                </Button>
                <Button variant="danger" size="sm" onClick={() => review(preview, "flag")} disabled={preview.status === "flagged"}>
                  <Flag className="h-3.5 w-3.5" /> Flag
                </Button>
                <Button variant="green" size="sm" onClick={() => review(preview, "approve")} disabled={preview.status === "approved"}>
                  <ShieldCheck className="h-3.5 w-3.5" /> Approve
                </Button>
                {isAdmin && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => { const p = preview; setPreview(null); openEdit(p); }}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setDeleteTarget(preview)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
                  <X className="h-3.5 w-3.5" /> Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------------------- Edit entry (super admin) ---------------------- */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit entry · {editTarget?.plate}</DialogTitle>
            <DialogDescription>
              Correct a mileage record. Changes are written to the audit log and the
              vehicle odometer is re-synced.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Entry type</Label>
                <Select
                  value={editForm.entryType}
                  onValueChange={(v) => setEditForm({ ...editForm, entryType: v })}
                >
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning Start</SelectItem>
                    <SelectItem value="evening">Evening End</SelectItem>
                    <SelectItem value="refuel">Refuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                >
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="flagged">Flagged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Odometer (km)</Label>
                <Input
                  inputMode="numeric"
                  value={editForm.odometerValue}
                  onChange={(e) =>
                    setEditForm({ ...editForm, odometerValue: e.target.value.replace(/[^0-9]/g, "") })
                  }
                  className="mt-1.5 font-mono font-semibold"
                />
              </div>
              <div>
                <Label>Distance (km)</Label>
                <Input
                  inputMode="numeric"
                  value={editForm.distanceKm}
                  onChange={(e) =>
                    setEditForm({ ...editForm, distanceKm: e.target.value.replace(/[^0-9]/g, "") })
                  }
                  className="mt-1.5 font-mono font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-navy/4 px-3.5 py-2.5">
              <span className="text-[13px] font-semibold text-navy/80">Temporary driver</span>
              <Switch
                checked={editForm.isTemporaryDriver}
                onCheckedChange={(v) => setEditForm({ ...editForm, isTemporaryDriver: v })}
              />
            </div>

            {editForm.isTemporaryDriver && (
              <div>
                <Label>Trip purpose *</Label>
                <Select
                  value={editForm.tripPurpose}
                  onValueChange={(v) => setEditForm({ ...editForm, tripPurpose: v })}
                >
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    {TRIP_PURPOSES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editForm.entryType === "refuel" && (
              <div className="grid grid-cols-3 gap-2 rounded-2xl border-2 border-dashed border-green/40 bg-green/5 p-3">
                <div>
                  <Label>Litres</Label>
                  <Input
                    inputMode="decimal"
                    value={editForm.liters}
                    onChange={(e) => setEditForm({ ...editForm, liters: e.target.value.replace(/[^0-9.]/g, "") })}
                    className="mt-1.5 font-mono"
                  />
                </div>
                <div>
                  <Label>Cost (€)</Label>
                  <Input
                    inputMode="decimal"
                    value={editForm.totalCost}
                    onChange={(e) => setEditForm({ ...editForm, totalCost: e.target.value.replace(/[^0-9.]/g, "") })}
                    className="mt-1.5 font-mono"
                  />
                </div>
                <div>
                  <Label>Station</Label>
                  <Input
                    value={editForm.stationName}
                    onChange={(e) => setEditForm({ ...editForm, stationName: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              </div>
            )}

            <div>
              <Label>Note</Label>
              <Input
                value={editForm.note}
                onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                placeholder="Optional correction note"
                className="mt-1.5"
              />
            </div>
          </div>

          {dialogError && (
            <p className="rounded-xl bg-red/10 px-3.5 py-2.5 text-sm font-semibold text-red">{dialogError}</p>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button
              onClick={saveEdit}
              disabled={
                dialogBusy ||
                !editForm.odometerValue ||
                (editForm.isTemporaryDriver && !editForm.tripPurpose)
              }
            >
              {dialogBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------- Delete entry (super admin) ---------------------- */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-red" /> Delete this entry?
            </DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  {entryTypeLabel(deleteTarget.entryType)} · {deleteTarget.plate} ·{" "}
                  {fmtNumber(deleteTarget.odometerValue)} km by {deleteTarget.driverName}.
                  This permanently removes the record{deleteTarget.refuel ? " and its refuel data" : ""}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {dialogError && (
            <p className="rounded-xl bg-red/10 px-3.5 py-2.5 text-sm font-semibold text-red">{dialogError}</p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={dialogBusy}>
              {dialogBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------- Record entry for a driver ------------------- */}
      <ManualLogDialog
        user={user}
        open={manualOpen}
        onOpenChange={setManualOpen}
        onCreated={(msg) => {
          setNotice(msg);
          setTimeout(() => setNotice(null), 4000);
          load();
        }}
      />
    </Card>
  );
}
