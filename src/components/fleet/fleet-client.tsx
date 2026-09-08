"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CarFront,
  Check,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserRoundPlus,
  Wrench,
} from "lucide-react";
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
import type { BranchDTO, SessionUserDTO } from "@/lib/types";
import { authFetch } from "@/lib/session-client";
import type { FleetRow } from "@/lib/data";
import { fmtNumber, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DriverOption = { id: string; fullName: string; branchId: string | null };

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-green/15 text-green-deep border-green/30" },
  maintenance: { label: "Maintenance", cls: "bg-yellow/30 text-[#8a6210] border-yellow/70" },
  retired: { label: "Retired", cls: "bg-navy/8 text-navy/50 border-navy/15" },
};

const EMPTY_FORM = {
  plateNumber: "",
  make: "",
  model: "",
  year: String(new Date().getFullYear()),
  fuelType: "diesel",
  branchId: "",
  primaryDriverId: "",
  currentOdometer: "0",
};

export function FleetClient({
  user,
  fleet,
  branches,
  drivers,
}: {
  user: SessionUserDTO;
  fleet: FleetRow[];
  branches: BranchDTO[];
  drivers: DriverOption[];
}) {
  const isAdmin = user.role === "super_admin";
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<FleetRow | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<FleetRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function openEdit(f: FleetRow) {
    setEditTarget(f);
    setError(null);
    setEditForm({
      plateNumber: f.vehicle.plateNumber,
      make: f.vehicle.make,
      model: f.vehicle.model,
      year: String(f.vehicle.year),
      fuelType: f.vehicle.fuelType,
      branchId: f.vehicle.branchId,
      primaryDriverId: f.vehicle.primaryDriverId ?? "",
      currentOdometer: String(f.vehicle.currentOdometer),
    });
  }

  async function saveEdit() {
    if (!editTarget) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/api/vehicles/${editTarget.vehicle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          year: Number(editForm.year),
          currentOdometer: Number(editForm.currentOdometer),
          primaryDriverId: editForm.primaryDriverId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setEditTarget(null);
      setNotice(`${editForm.plateNumber} updated`);
      setTimeout(() => setNotice(null), 2600);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeVehicle(f: FleetRow, mode: "auto" | "purge") {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/api/vehicles/${f.vehicle.id}?mode=${mode}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setDeleteTarget(null);
      setNotice(data.message);
      setTimeout(() => setNotice(null), 4200);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return fleet.filter((f) => {
      if (branchFilter !== "all" && f.vehicle.branchId !== branchFilter) return false;
      if (statusFilter !== "all" && f.vehicle.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        f.vehicle.plateNumber.toLowerCase().includes(needle) ||
        f.vehicle.model.toLowerCase().includes(needle) ||
        f.vehicle.make.toLowerCase().includes(needle) ||
        (f.primaryDriverName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [fleet, q, branchFilter, statusFilter]);

  const refresh = () => startTransition(() => router.refresh());

  async function patchVehicle(id: string, patch: Record<string, unknown>) {
    setRowBusy(id);
    try {
      await authFetch(`/api/vehicles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      refresh();
    } finally {
      setRowBusy(null);
    }
  }

  async function createVehicle() {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          year: Number(form.year),
          currentOdometer: Number(form.currentOdometer) || 0,
          primaryDriverId: form.primaryDriverId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setAddOpen(false);
      setForm(EMPTY_FORM);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const driversForBranch = drivers.filter((d) => d.branchId === form.branchId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-navy/45">
            <CarFront className="h-3.5 w-3.5" /> Vehicle registry
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-navy">Fleet</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {filtered.length} of {fleet.length} vehicles
            {!isAdmin && user.branchName ? ` · ${user.branchName} branch (read-only)` : ""}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Register vehicle
          </Button>
        )}
      </div>

      {notice && (
        <p className="flex items-start gap-2 rounded-xl border border-blue/25 bg-blue/8 px-3.5 py-2.5 text-[13px] font-semibold text-blue">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          {notice}
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Plate, model or driver…" className="pl-9" />
        </div>
        {isAdmin && (
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-[calc(50%_-_0.25rem)] sm:w-44">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={cn("sm:w-44", isAdmin ? "w-[calc(50%_-_0.25rem)]" : "w-full sm:w-44")}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid of vehicle cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((f) => {
          const v = f.vehicle;
          const st = STATUS_META[v.status];
          const kmL = f.litersMonth > 0 ? f.kmMonth / f.litersMonth : null;
          return (
            <Card key={v.id} className="group relative overflow-hidden p-5 transition-all hover:shadow-lift">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xl font-bold tracking-wider text-navy">{v.plateNumber}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {v.make} {v.model} · {v.year} · {v.fuelType}
                  </p>
                </div>
                <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", st.cls)}>
                  {v.status === "maintenance" ? <Wrench className="mr-1 inline h-3 w-3" /> : null}
                  {st.label}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-cream p-3 text-center">
                <div>
                  <p className="font-mono text-[15px] font-bold text-navy">{fmtNumber(v.currentOdometer)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-navy/40">Odometer</p>
                </div>
                <div>
                  <p className="font-mono text-[15px] font-bold text-navy">{fmtNumber(f.kmMonth)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-navy/40">Km · month</p>
                </div>
                <div>
                  <p className="font-mono text-[15px] font-bold text-navy">{kmL ? kmL.toFixed(1) : "—"}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-navy/40">km/L</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-navy/40">Primary driver</p>
                  {isAdmin ? (
                    <Select
                      value={v.primaryDriverId ?? "none"}
                      onValueChange={(val) => patchVehicle(v.id, { primaryDriverId: val === "none" ? null : val })}
                      disabled={rowBusy === v.id}
                    >
                      <SelectTrigger className="mt-1 h-9 border-navy/10 text-[13px]">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-ink-soft">Pool vehicle — unassigned</span>
                        </SelectItem>
                        {drivers
                          .filter((d) => d.branchId === v.branchId)
                          .map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="mt-1 truncate text-[13px] font-semibold text-navy">
                      {f.primaryDriverName ?? <span className="text-ink-soft">Pool vehicle</span>}
                    </p>
                  )}
                </div>
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={rowBusy === v.id} className="shrink-0">
                        {rowBusy === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Manage"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel>Manage vehicle</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openEdit(f)}>
                        <Pencil className="h-4 w-4 text-blue" /> Edit details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Status</DropdownMenuLabel>
                      {(["active", "maintenance", "retired"] as const).map((s) => (
                        <DropdownMenuItem key={s} onClick={() => patchVehicle(v.id, { status: s })} disabled={v.status === s}>
                          {STATUS_META[s].label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { setDeleteTarget(f); setError(null); }}>
                        <Trash2 className="h-4 w-4 text-red" /> Remove vehicle
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <p className="mt-3 border-t border-navy/6 pt-2.5 text-[11px] text-ink-soft/80">
                {f.branchName} branch {f.lastLogAt ? `· last log ${timeAgo(f.lastLogAt)}` : "· no logs yet"}
              </p>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-navy/15 p-14 text-center">
          <CarFront className="mx-auto h-8 w-8 text-navy/25" />
          <p className="mt-3 text-sm font-medium text-ink-soft">No vehicles match the filters.</p>
        </div>
      )}

      {/* Add vehicle dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRoundPlus className="h-5 w-5 text-blue" /> Register a vehicle
            </DialogTitle>
            <DialogDescription>
              Add a vehicle to the company fleet and optionally assign its primary driver.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Plate number *</Label>
              <Input
                value={form.plateNumber}
                onChange={(e) => setForm({ ...form, plateNumber: e.target.value.toUpperCase() })}
                placeholder="GA 421LM"
                className="mt-1.5 font-mono font-bold uppercase"
              />
            </div>
            <div>
              <Label>Make *</Label>
              <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Fiat" className="mt-1.5" />
            </div>
            <div>
              <Label>Model *</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Ducato" className="mt-1.5" />
            </div>
            <div>
              <Label>Year *</Label>
              <Input
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value.replace(/[^0-9]/g, "") })}
                inputMode="numeric"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Fuel type</Label>
              <Select value={form.fuelType} onValueChange={(v) => setForm({ ...form, fuelType: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="petrol">Petrol</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="lpg">LPG</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Branch *</Label>
              <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v, primaryDriverId: "" })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Odometer (km)</Label>
              <Input
                value={form.currentOdometer}
                onChange={(e) => setForm({ ...form, currentOdometer: e.target.value.replace(/[^0-9]/g, "") })}
                inputMode="numeric"
                className="mt-1.5 font-mono"
              />
            </div>
            <div className="col-span-2">
              <Label>Primary driver</Label>
              <Select
                value={form.primaryDriverId || "none"}
                onValueChange={(v) => setForm({ ...form, primaryDriverId: v === "none" ? "" : v })}
                disabled={!form.branchId}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={form.branchId ? "Select driver (optional)" : "Pick a branch first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned pool vehicle</SelectItem>
                  {driversForBranch.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="rounded-xl bg-red/10 px-3.5 py-2.5 text-sm font-semibold text-red">{error}</p>}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={createVehicle}
              disabled={busy || !form.plateNumber || !form.make || !form.model || !form.branchId || !form.year}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------- Edit vehicle ------------------------- */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editTarget?.vehicle.plateNumber}</DialogTitle>
            <DialogDescription>
              Update registration data, branch, assignment and odometer.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Plate number</Label>
              <Input
                value={editForm.plateNumber}
                onChange={(e) => setEditForm({ ...editForm, plateNumber: e.target.value.toUpperCase() })}
                className="mt-1.5 font-mono font-bold uppercase"
              />
            </div>
            <div>
              <Label>Make</Label>
              <Input value={editForm.make} onChange={(e) => setEditForm({ ...editForm, make: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>Model</Label>
              <Input value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>Year</Label>
              <Input
                inputMode="numeric"
                value={editForm.year}
                onChange={(e) => setEditForm({ ...editForm, year: e.target.value.replace(/[^0-9]/g, "") })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Fuel type</Label>
              <Select value={editForm.fuelType} onValueChange={(v) => setEditForm({ ...editForm, fuelType: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="petrol">Petrol</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="lpg">LPG</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Branch</Label>
              <Select
                value={editForm.branchId}
                onValueChange={(v) => setEditForm({ ...editForm, branchId: v, primaryDriverId: "" })}
              >
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Odometer (km)</Label>
              <Input
                inputMode="numeric"
                value={editForm.currentOdometer}
                onChange={(e) =>
                  setEditForm({ ...editForm, currentOdometer: e.target.value.replace(/[^0-9]/g, "") })
                }
                className="mt-1.5 font-mono"
              />
            </div>
            <div className="col-span-2">
              <Label>Primary driver</Label>
              <Select
                value={editForm.primaryDriverId || "none"}
                onValueChange={(v) => setEditForm({ ...editForm, primaryDriverId: v === "none" ? "" : v })}
              >
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned pool vehicle</SelectItem>
                  {drivers
                    .filter((d) => d.branchId === editForm.branchId)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="rounded-xl bg-red/10 px-3.5 py-2.5 text-sm font-semibold text-red">{error}</p>}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busy || !editForm.plateNumber || !editForm.make || !editForm.model}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------- Remove vehicle ------------------------- */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-red" /> Remove {deleteTarget?.vehicle.plateNumber}?
            </DialogTitle>
            <DialogDescription>
              Retiring keeps all mileage history for reporting. Deleting permanently
              also removes every log recorded against this vehicle.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="rounded-xl bg-red/10 px-3.5 py-2.5 text-sm font-semibold text-red">{error}</p>}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled={busy}
              onClick={() => deleteTarget && removeVehicle(deleteTarget, "auto")}
            >
              <Wrench className="h-4 w-4 text-[#a95a1d]" /> Retire vehicle, keep history
            </Button>
            <Button
              variant="danger"
              className="w-full justify-start"
              disabled={busy}
              onClick={() => deleteTarget && removeVehicle(deleteTarget, "purge")}
            >
              <Trash2 className="h-4 w-4" /> Delete permanently (with logs)
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
