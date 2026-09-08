"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Building2,
  CarFront,
  Check,
  IdCard,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserRoundCheck,
  Users,
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
import { ROLE_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/session-client";
import { CredentialBox } from "@/components/shared/credential-box";
import type { BranchDTO, SessionUserDTO } from "@/lib/types";
import type { PersonRow } from "@/lib/data";

const ROLE_BADGE: Record<string, "purple" | "blue" | "green"> = {
  super_admin: "purple",
  branch_manager: "blue",
  driver: "green",
};

type FormState = {
  fullName: string;
  email: string;
  role: string;
  branchId: string;
  phone: string;
  vehicleReg: string;
  drivingLicenceNumber: string;
  drivingLicenceExpiry: string;
};

const EMPTY: FormState = {
  fullName: "",
  email: "",
  role: "driver",
  branchId: "",
  phone: "",
  vehicleReg: "",
  drivingLicenceNumber: "",
  drivingLicenceExpiry: "",
};

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */
export function PeopleClient({
  user,
  people,
  branches,
}: {
  user: SessionUserDTO;
  people: PersonRow[];
  branches: BranchDTO[];
}) {
  const isAdmin = user.role === "super_admin";
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [fleetVehicles, setFleetVehicles] = useState<Array<{ id: string; plateNumber: string; branchId: string; label: string; primaryDriverId: string | null }>>([]);
  const [customPw, setCustomPw] = useState("");

  const [editTarget, setEditTarget] = useState<PersonRow | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY);

  const [credential, setCredential] = useState<
    { title: string; email: string; password: string; setAt?: string } | null
  >(null);
  const [pwTarget, setPwTarget] = useState<PersonRow | null>(null);
  const [manualPw, setManualPw] = useState("");
  const [removeTarget, setRemoveTarget] = useState<PersonRow | null>(null);

  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState(false);

  const refresh = () => startTransition(() => router.refresh());

  useEffect(() => {
    if (!addOpen) return;
    authFetch("/api/vehicles")
      .then((res) => (res.ok ? res.json() : { vehicles: [] }))
      .then((data) => {
        const pool = Array.isArray(data.vehicles) ? data.vehicles : [];
        setFleetVehicles(pool as Array<{ id: string; plateNumber: string; branchId: string; label: string; primaryDriverId: string | null }>);
      })
      .catch(() => setFleetVehicles([]));
  }, [addOpen]);

  const availableFleetForBranch = useMemo(
    () => fleetVehicles.filter((v) => v.branchId === form.branchId),
    [fleetVehicles, form.branchId]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return people.filter((p) => {
      if (roleFilter === "inactive" ? p.isActive : roleFilter !== "all" && p.role !== roleFilter) {
        return false;
      }
      if (!needle) return true;
      return (
        p.fullName.toLowerCase().includes(needle) ||
        p.email.toLowerCase().includes(needle) ||
        (p.branchName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [people, q, roleFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, PersonRow[]>();
    for (const p of filtered) {
      const key = p.branchName ?? "Head Office";
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const inactiveCount = people.filter((p) => !p.isActive).length;

  /* ------------------------------- actions ------------------------------- */
  async function createUser() {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, password: customPw || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setAddOpen(false);
      setForm(EMPTY);
      setCustomPw("");
      setCredential({
        title: `${data.fullName} can now sign in`,
        email: data.email,
        password: data.password,
      });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(p: PersonRow) {
    setEditTarget(p);
    setEditForm({
      fullName: p.fullName,
      email: p.email,
      role: p.role,
      branchId: p.branchId ?? "",
      phone: p.phone ?? "",
      vehicleReg: p.vehicleReg ?? "",
      drivingLicenceNumber: p.drivingLicenceNumber ?? "",
      drivingLicenceExpiry: p.drivingLicenceExpiry ? new Date(p.drivingLicenceExpiry).toISOString().slice(0, 10) : "",
    });
    setError(null);
  }

  async function saveEdit() {
    if (!editTarget) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/api/users/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...editForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setEditTarget(null);
      setNoticeError(false);
      setNotice(`${editForm.fullName} updated`);
      setTimeout(() => setNotice(null), 2600);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function viewPassword(p: PersonRow) {
    setRowBusy(p.id);
    try {
      const res = await authFetch(`/api/users/${p.id}/password`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setCredential({
        title: `Credentials for ${data.fullName}`,
        email: data.email,
        password: data.password ?? "— not available, generate a new one —",
        setAt: data.passwordSetAt,
      });
    } catch {
      setNoticeError(true);
      setNotice("Could not load credentials");
      setTimeout(() => setNotice(null), 2600);
    } finally {
      setRowBusy(null);
    }
  }

  async function resetPassword(p: PersonRow, manual?: string) {
    setBusy(true);
    setRowBusy(p.id);
    setError(null);
    try {
      const res = await authFetch(`/api/users/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          manual ? { action: "set_password", password: manual } : { action: "reset_password" }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setPwTarget(null);
      setManualPw("");
      setCredential({
        title: `New password for ${p.fullName}`,
        email: p.email,
        password: data.password,
      });
      refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      // the manual-password dialog is open for "set manually"; for the
      // menu-triggered generate action no dialog is open, so surface the
      // failure in the always-visible notice banner instead.
      if (manual) setError(msg);
      else {
        setNoticeError(true);
        setNotice(`Could not generate a new password — ${msg}`);
        setTimeout(() => setNotice(null), 4000);
      }
    } finally {
      setBusy(false);
      setRowBusy(null);
    }
  }

  async function setActive(p: PersonRow, isActive: boolean) {
    setRowBusy(p.id);
    try {
      const res = await authFetch(`/api/users/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_active", isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setNoticeError(false);
      setNotice(`${p.fullName} ${isActive ? "reactivated" : "deactivated"}`);
      setTimeout(() => setNotice(null), 2600);
      refresh();
    } catch (e) {
      setNoticeError(true);
      setNotice(e instanceof Error ? e.message : "Failed");
      setTimeout(() => setNotice(null), 3200);
    } finally {
      setRowBusy(null);
    }
  }

  async function removeUser(p: PersonRow, mode: "auto" | "purge") {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/api/users/${p.id}?mode=${mode}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setRemoveTarget(null);
      setNoticeError(false);
      setNotice(data.message);
      setTimeout(() => setNotice(null), 4200);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const driversForBranch = (branchId: string) => branches.find((b) => b.id === branchId);
  void driversForBranch;

  /* -------------------------------- render -------------------------------- */
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-navy/45 sm:text-[11px] sm:tracking-[0.22em]">
            <Users className="h-3.5 w-3.5" /> Team directory
          </p>
          <h1 className="mt-1.5 font-display text-[28px] font-bold tracking-tight text-navy sm:mt-2 sm:text-3xl">
            People
          </h1>
          <p className="mt-1 text-[13px] text-ink-soft sm:text-sm">
            {filtered.length} of {people.length} accounts
            {inactiveCount > 0 ? ` · ${inactiveCount} deactivated` : ""}
            {!isAdmin && user.branchName ? ` · ${user.branchName} branch` : ""}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setForm(EMPTY); setCustomPw(""); setError(null); setAddOpen(true); }} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Add teammate
          </Button>
        )}
      </div>

      {notice && (
        <p
          className={cn(
            "flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold",
            noticeError
              ? "border-red/25 bg-red/8 text-red"
              : "border-blue/25 bg-blue/8 text-blue"
          )}
        >
          {noticeError ? (
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {notice}
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or branch…" className="pl-9" />
        </div>
        <div className="no-scrollbar -mx-1 flex w-full gap-1.5 overflow-x-auto px-1 sm:w-auto">
          {[
            { v: "all", l: "All" },
            { v: "branch_manager", l: "Managers" },
            { v: "driver", l: "Drivers" },
            ...(isAdmin ? [{ v: "inactive", l: "Deactivated" }] : []),
          ].map((r) => (
            <button
              key={r.v}
              onClick={() => setRoleFilter(r.v)}
              className={cn(
                "shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer",
                roleFilter === r.v ? "bg-navy text-cream shadow" : "bg-navy/6 text-navy/55 active:bg-navy/12"
              )}
            >
              {r.l}
            </button>
          ))}
        </div>
      </div>

      {/* Directory */}
      <div className="space-y-6">
        {grouped.map(([branch, members]) => (
          <section key={branch}>
            <p className="mb-2.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-navy/45 sm:text-[11px]">
              <Building2 className="h-3.5 w-3.5" />
              {branch}
              <span className="rounded-full bg-navy/8 px-2 py-0.5 text-[10px]">{members.length}</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {members.map((p) => (
                <Card
                  key={p.id}
                  className={cn(
                    "min-w-0 rounded-2xl p-4 transition-all sm:rounded-3xl",
                    !p.isActive && "opacity-70 ring-1 ring-red/20"
                  )}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={p.fullName} color={p.avatarColor} className="h-11 w-11 shrink-0 rounded-xl" textClassName="text-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-navy">{p.fullName}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant={ROLE_BADGE[p.role]}>{ROLE_LABELS[p.role]}</Badge>
                        {!p.isActive && <Badge variant="red">Deactivated</Badge>}
                        {p.id === user.id && <Badge variant="outline">You</Badge>}
                      </div>
                    </div>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={rowBusy === p.id} aria-label="Manage account">
                            {rowBusy === p.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Pencil className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Manage account</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4 text-blue" /> Edit details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => viewPassword(p)}>
                            <KeyRound className="h-4 w-4 text-navy/60" /> View credentials
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => resetPassword(p)}>
                            <RefreshCw className="h-4 w-4 text-green-deep" /> Generate new password
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setPwTarget(p); setManualPw(""); setError(null); }}>
                            <KeyRound className="h-4 w-4 text-purple" /> Set password manually
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {p.isActive ? (
                            <DropdownMenuItem onClick={() => setActive(p, false)} disabled={p.id === user.id}>
                              <Ban className="h-4 w-4 text-[#a95a1d]" /> Deactivate access
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setActive(p, true)}>
                              <UserRoundCheck className="h-4 w-4 text-green-deep" /> Reactivate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => { setRemoveTarget(p); setError(null); }}
                            disabled={p.id === user.id}
                          >
                            <Trash2 className="h-4 w-4 text-red" /> Remove teammate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <div className="mt-3.5 space-y-1.5 text-xs text-ink-soft">
                    <p className="flex items-center gap-2 truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-navy/35" />
                      <span className="truncate">{p.email}</span>
                    </p>
                    {p.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-navy/35" /> {p.phone}
                      </p>
                    )}
                    {p.role === "driver" && (
                      <>
                        <p className="flex items-center gap-2 truncate">
                          <IdCard className="h-3.5 w-3.5 shrink-0 text-navy/35" />
                          {p.drivingLicenceNumber ? (
                            <span className="font-mono">{p.drivingLicenceNumber}</span>
                          ) : (
                            <span className="text-navy/35">No driving licence on file</span>
                          )}
                        </p>
                        {p.drivingLicenceExpiry && (
                          <p className="flex items-center gap-2 truncate text-[11px] text-navy/55">
                            <span className="inline-block w-3.5" />
                            Expires {new Date(p.drivingLicenceExpiry).toLocaleDateString("en-GB")}
                          </p>
                        )}
                      </>
                    )}
                    <p className="flex items-center gap-2 truncate">
                      <CarFront className="h-3.5 w-3.5 shrink-0 text-navy/35" />
                      {p.vehicleReg ? (
                        <span className="truncate font-mono font-semibold text-navy/70">
                          {p.vehicleReg}
                        </span>
                      ) : (
                        <span className="text-navy/35">No vehicle reg</span>
                      )}
                    </p>
                  </div>

                  {isAdmin && (
                    <p className="mt-3 border-t border-navy/6 pt-2 text-[10px] text-ink-soft/80">
                      {p.logCount} logs · last sign-in{" "}
                      {p.lastLoginAt ? fmtDate(p.lastLoginAt) : "never"}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      {grouped.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-navy/15 p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-navy/25" />
          <p className="mt-3 text-sm font-medium text-ink-soft">No one matches this search.</p>
        </div>
      )}

      {/* ----------------------------- Add teammate ----------------------------- */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a teammate</DialogTitle>
            <DialogDescription>
              A random password is generated automatically — you can copy it on the next step.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full name *</Label>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Francesca Neri" className="mt-1.5" />
            </div>
            <div>
              <Label>Work email *</Label>
              <Input
                type="email"
                autoCapitalize="none"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="francesca.neri@meridian-group.it"
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="driver">Driver</SelectItem>
                    <SelectItem value="branch_manager">Branch Manager</SelectItem>
                    <SelectItem value="super_admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Branch</Label>
                <Select
                  value={form.branchId}
                  onValueChange={(v) => setForm({ ...form, branchId: v })}
                  disabled={form.role === "super_admin"}
                >
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+39 340 000 0000" className="mt-1.5" />
              </div>
              <div>
                <Label>Vehicle Reg.</Label>
                <Select
                  value={form.vehicleReg || "none"}
                  onValueChange={(v) => setForm({ ...form, vehicleReg: v === "none" ? "" : v })}
                  disabled={form.role === "super_admin" || !form.branchId}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder={form.branchId ? "Select available vehicle" : "Pick a branch first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Leave blank / no assigned vehicle</SelectItem>
                    {availableFleetForBranch.map((v) => (
                      <SelectItem key={v.id} value={v.plateNumber}>{v.plateNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.role === "driver" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Driving Licence No.</Label>
                  <Input
                    value={form.drivingLicenceNumber}
                    onChange={(e) => setForm({ ...form, drivingLicenceNumber: e.target.value })}
                    placeholder="U1234567X"
                    className="mt-1.5 font-mono"
                  />
                </div>
                <div>
                  <Label>Expiry date</Label>
                  <Input
                    type="date"
                    value={form.drivingLicenceExpiry}
                    onChange={(e) => setForm({ ...form, drivingLicenceExpiry: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              </div>
            )}
            <div>
              <Label>Password (optional)</Label>
              <Input
                value={customPw}
                onChange={(e) => setCustomPw(e.target.value)}
                placeholder="Leave blank to generate automatically"
                className="mt-1.5 font-mono"
              />
            </div>
          </div>
          {error && <p className="rounded-xl bg-red/10 px-3.5 py-2.5 text-sm font-semibold text-red">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={createUser}
              disabled={busy || !form.fullName || !form.email.includes("@") || (form.role !== "super_admin" && !form.branchId)}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------- Edit user ------------------------------- */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editTarget?.fullName}</DialogTitle>
            <DialogDescription>Update profile, driver data, role and branch.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>Work email</Label>
              <Input type="email" autoCapitalize="none" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Role</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="driver">Driver</SelectItem>
                    <SelectItem value="branch_manager">Branch Manager</SelectItem>
                    <SelectItem value="super_admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Branch</Label>
                <Select
                  value={editForm.branchId}
                  onValueChange={(v) => setEditForm({ ...editForm, branchId: v })}
                  disabled={editForm.role === "super_admin"}
                >
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>Vehicle Reg.</Label>
                <Select
                  value={editForm.vehicleReg || "none"}
                  onValueChange={(v) => setEditForm({ ...editForm, vehicleReg: v === "none" ? "" : v })}
                  disabled={editForm.role === "super_admin" || !editForm.branchId}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder={editForm.branchId ? "Select available vehicle" : "Pick a branch first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Leave blank / no assigned vehicle</SelectItem>
                    {fleetVehicles
                      .filter((v) => v.branchId === editForm.branchId)
                      .map((v) => (
                        <SelectItem key={v.id} value={v.plateNumber}>{v.plateNumber}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editForm.role === "driver" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Driving Licence No.</Label>
                  <Input
                    value={editForm.drivingLicenceNumber}
                    onChange={(e) => setEditForm({ ...editForm, drivingLicenceNumber: e.target.value })}
                    className="mt-1.5 font-mono"
                  />
                </div>
                <div>
                  <Label>Expiry date</Label>
                  <Input
                    type="date"
                    value={editForm.drivingLicenceExpiry}
                    onChange={(e) => setEditForm({ ...editForm, drivingLicenceExpiry: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              </div>
            )}
          </div>
          {error && <p className="rounded-xl bg-red/10 px-3.5 py-2.5 text-sm font-semibold text-red">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busy || !editForm.fullName || !editForm.email.includes("@")}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------- Manual password --------------------------- */}
      <Dialog open={!!pwTarget} onOpenChange={(o) => !o && setPwTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set password</DialogTitle>
            <DialogDescription>
              Choose a password for {pwTarget?.fullName}. Minimum 8 characters with a letter and a number.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={manualPw}
            onChange={(e) => setManualPw(e.target.value)}
            placeholder="e.g. Harbor-Trail-Fox-204"
            className="font-mono"
            autoFocus
          />
          {error && <p className="rounded-xl bg-red/10 px-3.5 py-2.5 text-sm font-semibold text-red">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwTarget(null)}>Cancel</Button>
            <Button onClick={() => pwTarget && resetPassword(pwTarget, manualPw)} disabled={busy || manualPw.length < 8}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Set password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------ Credentials ------------------------------ */}
      <Dialog open={!!credential} onOpenChange={(o) => !o && setCredential(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{credential?.title}</DialogTitle>
            <DialogDescription>
              {credential?.setAt
                ? `Password last set ${fmtDate(credential.setAt)}.`
                : "Save these credentials now."}
            </DialogDescription>
          </DialogHeader>
          {credential && <CredentialBox email={credential.email} password={credential.password} />}
          <DialogFooter>
            <Button onClick={() => setCredential(null)}>
              <Check className="h-4 w-4" /> Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------ Remove user ------------------------------ */}
      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-red" /> Remove {removeTarget?.fullName}?
            </DialogTitle>
            <DialogDescription>
              {removeTarget && removeTarget.logCount > 0 ? (
                <>
                  This teammate has <strong>{removeTarget.logCount} mileage logs</strong>. Removing
                  access keeps that history intact for reporting — recommended.
                </>
              ) : (
                "This teammate has no mileage history and can be deleted permanently."
              )}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="rounded-xl bg-red/10 px-3.5 py-2.5 text-sm font-semibold text-red">{error}</p>}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled={busy}
              onClick={() => removeTarget && removeUser(removeTarget, "auto")}
            >
              <Ban className="h-4 w-4 text-[#a95a1d]" />
              Remove access, keep history
            </Button>
            <Button
              variant="danger"
              className="w-full justify-start"
              disabled={busy}
              onClick={() => removeTarget && removeUser(removeTarget, "purge")}
            >
              <Trash2 className="h-4 w-4" />
              Delete permanently
              {removeTarget && removeTarget.logCount > 0 ? ` (+${removeTarget.logCount} logs)` : ""}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
