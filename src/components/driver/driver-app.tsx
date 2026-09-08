"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  CircleDot,
  Clock,
  Crosshair,
  Fuel,
  History,
  Loader2,
  MapPin,
  Sunrise,
  Sunset,
  UserRoundCheck,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PhotoUpload } from "@/components/driver/photo-upload";
import { VehiclePicker } from "@/components/driver/vehicle-picker";
import {
  entryTypeLabel,
  FEATURES,
  purposeLabel,
  STATIONS,
  STATUS_STYLES,
  TRIP_PURPOSES,
} from "@/lib/constants";
import { fmtDateTime, fmtNumber, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/session-client";
import type { LogRow, SessionUserDTO, VehicleOption } from "@/lib/types";

type EntryType = "morning" | "evening" | "refuel";

const ENTRY_TABS: { value: EntryType; label: string; icon: typeof Sunrise }[] = [
  { value: "morning", label: "Morning Start", icon: Sunrise },
  { value: "evening", label: "Evening End", icon: Sunset },
  { value: "refuel", label: "Refuel", icon: Fuel },
];

export function DriverApp({
  user,
  myVehicles,
  recentLogs,
}: {
  user: SessionUserDTO;
  myVehicles: VehicleOption[];
  recentLogs: LogRow[];
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const hour = now ? now.getHours() : 9;
  const defaultType: EntryType = hour < 12 ? "morning" : hour < 16 ? "refuel" : "evening";

  const [entryType, setEntryType] = useState<EntryType>(defaultType);
  const [useOther, setUseOther] = useState(myVehicles.length === 0);
  const [vehicle, setVehicle] = useState<VehicleOption | null>(myVehicles[0] ?? null);
  const [purpose, setPurpose] = useState("");
  const [odo, setOdo] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [liters, setLiters] = useState("");
  const [cost, setCost] = useState("");
  const [station, setStation] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ temporary: boolean; flagged: boolean } | null>(null);
  const [logs, setLogs] = useState<LogRow[]>(recentLogs);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  const isTemp = !!vehicle && vehicle.primaryDriverId !== user.id;
  const odoNum = Number(odo);
  const delta = vehicle && Number.isFinite(odoNum) && odoNum > 0 ? odoNum - vehicle.currentOdometer : null;

  // when switching back to primary vehicle, clear override state
  useEffect(() => {
    if (!useOther && myVehicles[0]) {
      setVehicle(myVehicles[0]);
      setPurpose("");
    }
  }, [useOther, myVehicles]);

  const canSubmit = useMemo(() => {
    if (!vehicle) return false;
    if (!Number.isFinite(odoNum) || odoNum <= 0) return false;
    if (isTemp && !purpose) return false;
    if (entryType === "refuel") {
      const l = Number(liters);
      const c = Number(cost);
      if (!Number.isFinite(l) || l <= 0) return false;
      if (!Number.isFinite(c) || c <= 0) return false;
    }
    return true;
  }, [vehicle, odoNum, isTemp, purpose, entryType, liters, cost]);

  function captureLocation() {
    if (!navigator.geolocation) return;
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoBusy(false);
      },
      () => setGeoBusy(false),
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }

  async function refreshLogs() {
    try {
      const res = await authFetch("/api/logs?limit=14");
      const data = await res.json();
      if (res.ok) setLogs(data.rows);
    } catch {
      /* keep stale list */
    }
  }

  async function submit() {
    if (!canSubmit || !vehicle || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: vehicle.id,
          entryType,
          odometerValue: odoNum,
          tripPurpose: isTemp ? purpose : null,
          photoUrl: FEATURES.photoCapture ? photo : null,
          note: note || null,
          locationLat: coords?.lat ?? null,
          locationLng: coords?.lng ?? null,
          refuel:
            entryType === "refuel"
              ? {
                  liters: Number(liters),
                  totalCost: Number(cost),
                  stationName: station || null,
                  receiptUrl: FEATURES.photoCapture ? receipt : null,
                }
              : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setSuccess({ temporary: data.isTemporary, flagged: data.status === "flagged" });
      // reset fast for the next entry
      setOdo("");
      setNote("");
      setPhoto(null);
      setPurpose("");
      setLiters("");
      setCost("");
      setStation("");
      setReceipt(null);
      await refreshLogs();
      setTimeout(() => setSuccess(null), 2400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  const greeting = !now
    ? "Hello"
    : hour < 12
      ? "Good morning"
      : hour < 18
        ? "Good afternoon"
        : "Good evening";

  return (
    <div className="mx-auto w-full max-w-6xl pb-20 lg:pb-0">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* ============================ LEFT: ENTRY ============================ */}
        <div>
          {/* Greeting */}
          <div className="relative overflow-hidden rounded-3xl bg-navy p-5 text-cream sm:p-6">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 85% 20%, rgba(0,215,255,0.18), transparent 40%), radial-gradient(circle at 15% 90%, rgba(8,220,125,0.22), transparent 45%)",
              }}
            />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <Avatar name={user.fullName} color={user.avatarColor} className="h-12 w-12 rounded-2xl" textClassName="text-sm" />
                <div>
                  <p className="text-xs font-medium text-cream/60">
                    {greeting},
                  </p>
                  <h1 className="font-display text-xl font-bold leading-tight sm:text-2xl">
                    {user.fullName.split(" ")[0]}
                  </h1>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-[13px] font-semibold text-green">
                  {now
                    ? now.toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        timeZone: "Europe/Rome",
                      })
                    : "Today"}
                </p>
                <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-cream/50">
                  {user.branchName ?? "Head Office"}
                </p>
              </div>
            </div>
          </div>

          {/* Entry type segmented control */}
          <div className="mt-5 grid grid-cols-3 gap-1.5 rounded-2xl bg-navy/6 p-1.5">
            {ENTRY_TABS.map((t) => {
              const active = entryType === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setEntryType(t.value)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer sm:flex-row sm:justify-center sm:gap-2 sm:text-xs",
                    active ? "text-cream" : "text-navy/50 hover:text-navy"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="entry-pill"
                      className="absolute inset-0 rounded-xl bg-navy shadow-lift"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <t.icon className={cn("relative h-4.5 w-4.5", active && "text-green")} />
                  <span className="relative">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Vehicle card */}
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-navy/45">Vehicle</p>
              {myVehicles.length > 0 && (
                <label className="flex cursor-pointer items-center gap-2">
                  <span className="text-xs font-semibold text-navy/60">Different vehicle today?</span>
                  <Switch checked={useOther} onCheckedChange={setUseOther} />
                </label>
              )}
            </div>

            <AnimatePresence mode="wait">
              {!useOther && myVehicles[0] ? (
                <motion.div
                  key="assigned"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="relative overflow-hidden rounded-3xl border-2 border-green/40 bg-white p-5 shadow-tactile"
                >
                  <span className="absolute right-0 top-0 max-w-[52%] truncate rounded-bl-2xl bg-green px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide text-navy sm:max-w-none sm:px-3 sm:text-[10px] sm:tracking-wider">
                    <span className="sm:hidden">Assigned to you</span>
                    <span className="hidden sm:inline">Your assigned vehicle</span>
                  </span>
                  <p className="font-mono text-[26px] font-bold tracking-wider text-navy sm:text-3xl">
                    {myVehicles[0].plateNumber}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">{myVehicles[0].label}</p>
                  {myVehicles.length > 1 && (
                    <p className="mt-2 text-xs font-semibold text-blue">
                      + {myVehicles.length - 1} more assigned — toggle to switch
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-cream px-3 py-2">
                    <CircleDot className="h-4 w-4 text-blue" />
                    <p className="text-xs font-semibold text-navy/70">
                      Last recorded: <span className="font-mono">{fmtNumber(myVehicles[0].currentOdometer)} km</span>
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="picker"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <VehiclePicker user={user} selected={vehicle} onSelect={setVehicle} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Temporary use warning + mandatory purpose */}
            <AnimatePresence>
              {vehicle && isTemp && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-2xl border-2 border-[#e8935e]/50 bg-[#e8935e]/10 p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8935e]/20 text-[#a95a1d]">
                        <AlertTriangle className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#7c4211]">Temporary driver detected</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[#7c4211]/80">
                          {vehicle.primaryDriverName
                            ? `${vehicle.plateNumber} is assigned to ${vehicle.primaryDriverName}. `
                            : `${vehicle.plateNumber} is a pool vehicle. `}
                          This entry will be <strong>flagged for manager audit</strong> — state your reason below.
                        </p>
                        <div className="mt-3">
                          <Label htmlFor="purpose" className="text-[#7c4211]">
                            Purpose of temporary use <span className="text-red">*</span>
                          </Label>
                          <Select value={purpose} onValueChange={setPurpose}>
                            <SelectTrigger id="purpose" className="mt-1.5 border-[#e8935e]/60 bg-white">
                              <SelectValue placeholder="Select trip reason…" />
                            </SelectTrigger>
                            <SelectContent>
                              {TRIP_PURPOSES.map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                  <span className="flex flex-col py-0.5">
                                    <span>{p.label}</span>
                                    <span className="text-[11px] font-normal text-ink-soft">{p.hint}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Odometer */}
          <div className="mt-5">
            <div className="mb-1.5 flex items-end justify-between">
              <Label htmlFor="odo" className="text-[13px]">
                Current odometer reading
              </Label>
              {vehicle && (
                <span className="font-mono text-[11px] text-navy/45">
                  prev {fmtNumber(vehicle.currentOdometer)} km
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                id="odo"
                inputMode="numeric"
                pattern="[0-9]*"
                value={odo}
                onChange={(e) => setOdo(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 86420"
                className="h-16 rounded-2xl border-navy/15 bg-white pr-16 font-mono text-[26px] font-bold tracking-wider shadow-tactile"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-navy/35">
                KM
              </span>
            </div>
            <AnimatePresence>
              {delta !== null && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "mt-2 flex items-center gap-1.5 text-xs font-bold",
                    delta < 0 ? "text-red" : delta === 0 ? "text-navy/45" : "text-green-deep"
                  )}
                >
                  {delta < 0 ? (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {fmtNumber(Math.abs(delta))} km below the record — will be flagged for review
                    </>
                  ) : delta === 0 ? (
                    "No distance since the previous reading"
                  ) : (
                    <>
                      <BadgeCheck className="h-3.5 w-3.5" /> +{fmtNumber(delta)} km since last reading
                    </>
                  )}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Photos — controlled by FEATURES.photoCapture (currently off) */}
          {FEATURES.photoCapture && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <PhotoUpload
                label="Odometer photo"
                hint="Snap the dashboard"
                value={photo}
                onChange={setPhoto}
              />
              {entryType === "refuel" && (
                <PhotoUpload
                  label="Fuel receipt"
                  hint="Snap the receipt"
                  value={receipt}
                  onChange={setReceipt}
                  required
                />
              )}
            </div>
          )}

          {/* Refuel details */}
          <AnimatePresence>
            {entryType === "refuel" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-1 rounded-2xl border-2 border-dashed border-green/50 bg-green/5 p-4">
                  <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-green-deep">
                    <Fuel className="h-4 w-4" /> Refuel details
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="liters">Litres *</Label>
                      <Input
                        id="liters"
                        inputMode="decimal"
                        value={liters}
                        onChange={(e) => setLiters(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="42.5"
                        className="mt-1.5 font-mono font-semibold"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cost">Total cost (€) *</Label>
                      <Input
                        id="cost"
                        inputMode="decimal"
                        value={cost}
                        onChange={(e) => setCost(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="78.40"
                        className="mt-1.5 font-mono font-semibold"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <Label htmlFor="station">Fuel station</Label>
                    <Input
                      id="station"
                      list="stations"
                      value={station}
                      onChange={(e) => setStation(e.target.value)}
                      placeholder="Eni, IP, Q8…"
                      className="mt-1.5"
                    />
                    <datalist id="stations">
                      {STATIONS.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                  {Number(liters) > 0 && Number(cost) > 0 && (
                    <p className="mt-3 text-xs font-bold text-green-deep">
                      ≈ €{(Number(cost) / Number(liters)).toFixed(3)} per litre
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Note + location */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note (client visit, detour…)"
              className="h-12 flex-1 rounded-xl"
            />
            <Button
              type="button"
              variant={coords ? "green" : "outline"}
              className="h-12 rounded-xl"
              onClick={captureLocation}
              disabled={geoBusy}
            >
              {geoBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : coords ? (
                <MapPin className="h-4 w-4" />
              ) : (
                <Crosshair className="h-4 w-4" />
              )}
              {coords ? "Location tagged" : "Tag location"}
            </Button>
          </div>

          {error && (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-red/30 bg-red/8 px-4 py-3 text-sm font-semibold text-red">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          {/* Submit */}
          <Button
            size="xl"
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="mt-6 hidden w-full justify-between rounded-2xl px-6 lg:flex"
            variant={isTemp ? "yellow" : "default"}
          >
            <span className="flex items-center gap-2.5">
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <UserRoundCheck className="h-5 w-5" />
              )}
              {submitting
                ? "Submitting…"
                : isTemp
                  ? "Submit as temporary driver"
                  : `Submit ${entryTypeLabel(entryType)}`}
            </span>
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>

        {/* ============================ RIGHT: HISTORY ============================ */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-navy/45">
              <History className="h-4 w-4" /> Recent submissions
            </p>
            <span className="text-xs text-ink-soft">{logs.length} shown</span>
          </div>

          <div className="space-y-2.5">
            {logs.length === 0 && (
              <div className="rounded-3xl border-2 border-dashed border-navy/15 p-10 text-center">
                <Clock className="mx-auto h-8 w-8 text-navy/25" />
                <p className="mt-3 text-sm font-medium text-ink-soft">
                  No entries yet — your first log is one tap away.
                </p>
              </div>
            )}
            {logs.map((log, i) => {
              const st = STATUS_STYLES[log.status];
              const Icon = log.entryType === "morning" ? Sunrise : log.entryType === "evening" ? Sunset : Fuel;
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="flex items-center gap-3 rounded-2xl border border-navy/8 bg-white/80 p-3 shadow-tactile"
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      log.entryType === "morning" && "bg-yellow/40 text-[#8a6210]",
                      log.entryType === "evening" && "bg-purple/10 text-purple",
                      log.entryType === "refuel" && "bg-green/15 text-green-deep"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-mono text-[13px] font-bold text-navy">{log.plate}</p>
                      {log.isTemporaryDriver && (
                        <Badge variant="amber" className="px-1.5 py-0 text-[9px]">Temp</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-soft" suppressHydrationWarning>
                      {entryTypeLabel(log.entryType)} · {fmtNumber(log.odometerValue)} km ·{" "}
                      <span suppressHydrationWarning>{now ? timeAgo(log.createdAt) : ""}</span>
                      {log.refuel ? ` · €${Number(log.refuel.totalCost).toFixed(2)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge className={cn("border", st.className)}>{st.label}</Badge>
                    {(log.photoUrl || log.refuel?.receiptUrl) && (
                      <button
                        onClick={() =>
                          setPreview({
                            url: (log.photoUrl ?? log.refuel?.receiptUrl)!,
                            title: `${log.plate} · ${entryTypeLabel(log.entryType)}`,
                          })
                        }
                        className="text-[10px] font-bold uppercase tracking-wider text-blue hover:underline cursor-pointer"
                      >
                        View photo
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Persistent one-handed submit action on phones */}
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 border-t border-navy/8 bg-cream/94 px-3 py-2.5 shadow-[0_-12px_30px_-20px_rgba(33,38,78,0.55)] backdrop-blur-xl lg:hidden">
        <Button
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="mx-auto h-13 w-full max-w-lg justify-between rounded-2xl px-5 text-sm"
          variant={isTemp ? "yellow" : "default"}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <UserRoundCheck className="h-5 w-5" />
            )}
            <span className="truncate">
              {submitting
                ? "Submitting…"
                : isTemp
                  ? "Submit temporary use"
                  : `Submit ${entryTypeLabel(entryType)}`}
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0" />
        </Button>
      </div>

      {/* ------------------------- Success overlay ------------------------- */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="mx-4 flex w-full max-w-sm flex-col items-center rounded-3xl bg-cream p-8 text-center shadow-lift"
            >
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 340, damping: 16 }}
                className={cn(
                  "flex h-18 w-18 items-center justify-center rounded-full",
                  success.flagged ? "bg-yellow" : "bg-green"
                )}
              >
                {success.flagged ? <AlertTriangle className="h-9 w-9 text-navy" /> : <Check className="h-9 w-9 text-navy" strokeWidth={3} />}
              </motion.span>
              <h3 className="mt-5 font-display text-2xl font-bold text-navy">
                {success.flagged ? "Logged — under review" : "Entry logged"}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {success.flagged
                  ? "The odometer reading conflicts with fleet records. Your manager has been notified."
                  : success.temporary
                    ? "Recorded as temporary usage — visible to your branch manager for audit."
                    : "Synced to Lyca Fleet Tracker. Safe driving out there."}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------- Photo preview ------------------------- */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl border-0 bg-navy p-3" hideClose={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>{preview?.title}</DialogTitle>
            <DialogDescription>Captured photo</DialogDescription>
          </DialogHeader>
          {preview && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt={preview.title} className="max-h-[70dvh] w-full rounded-2xl object-contain" />
              <p className="pb-1 pt-2 text-center text-xs font-semibold text-cream/70">{preview.title}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
