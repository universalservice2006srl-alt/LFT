"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CarFront,
  Check,
  Fuel,
  Loader2,
  UserRoundCog,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATIONS, TRIP_PURPOSES } from "@/lib/constants";
import { fmtNumber } from "@/lib/format";
import { authFetch } from "@/lib/session-client";
import type { SessionUserDTO, VehicleOption } from "@/lib/types";

type DriverOpt = {
  id: string;
  fullName: string;
  role: string;
  branchId: string | null;
  branchName: string | null;
  plates: string[];
};

export function ManualLogDialog({
  user,
  open,
  onOpenChange,
  onCreated,
}: {
  user: SessionUserDTO;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (msg: string) => void;
}) {
  const [drivers, setDrivers] = useState<DriverOpt[]>([]);
  const [vehiclesList, setVehiclesList] = useState<VehicleOption[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(false);

  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [entryType, setEntryType] = useState("morning");
  const [odo, setOdo] = useState("");
  const [purpose, setPurpose] = useState("");
  const [note, setNote] = useState("");
  const [liters, setLiters] = useState("");
  const [cost, setCost] = useState("");
  const [station, setStation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingOpts(true);
    Promise.all([
      authFetch("/api/drivers").then((r) => (r.ok ? r.json() : { drivers: [] })),
      authFetch("/api/vehicles").then((r) => (r.ok ? r.json() : { vehicles: [] })),
    ])
      .then(([d, v]) => {
        setDrivers(d.drivers ?? []);
        setVehiclesList(v.vehicles ?? []);
      })
      .finally(() => setLoadingOpts(false));
  }, [open]);

  const vehicle = useMemo(
    () => vehiclesList.find((v) => v.id === vehicleId) ?? null,
    [vehiclesList, vehicleId]
  );
  const driver = useMemo(
    () => drivers.find((d) => d.id === driverId) ?? null,
    [drivers, driverId]
  );

  // Branch managers may only pair drivers and vehicles from their own branch.
  const selectableVehicles = useMemo(() => {
    if (!driver) return vehiclesList;
    return vehiclesList.filter((v) => !driver.branchId || v.branchId === driver.branchId);
  }, [vehiclesList, driver]);

  const isTemporary = !!vehicle && !!driver && vehicle.primaryDriverId !== driver.id;

  const canSubmit =
    !!driverId &&
    !!vehicleId &&
    Number(odo) > 0 &&
    (!isTemporary || !!purpose) &&
    (entryType !== "refuel" || (Number(liters) > 0 && Number(cost) > 0));

  function reset() {
    setDriverId("");
    setVehicleId("");
    setEntryType("morning");
    setOdo("");
    setPurpose("");
    setNote("");
    setLiters("");
    setCost("");
    setStation("");
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId,
          vehicleId,
          entryType,
          odometerValue: Number(odo),
          tripPurpose: isTemporary ? purpose : null,
          note: note || null,
          refuel:
            entryType === "refuel"
              ? {
                  liters: Number(liters),
                  totalCost: Number(cost),
                  stationName: station || null,
                }
              : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save the entry");
      onCreated(
        `Entry filed for ${driver?.fullName ?? "driver"}${
          data.status === "flagged" ? " — auto-flagged for review" : ""
        }`
      );
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the entry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundCog className="h-5 w-5 text-blue" /> Record entry for a driver
          </DialogTitle>
          <DialogDescription>
            {user.role === "super_admin"
              ? "Choose any driver and any active vehicle across the company."
              : `Choose any driver and vehicle from the ${user.branchName} branch.`}{" "}
            The entry is attributed to the driver and this action is audited.
          </DialogDescription>
        </DialogHeader>

        {loadingOpts ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-ink-soft">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading drivers and vehicles…
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Driver *</Label>
              <Select
                value={driverId}
                onValueChange={(v) => {
                  setDriverId(v);
                  setVehicleId("");
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="flex flex-col py-0.5">
                        <span>{d.fullName}</span>
                        <span className="text-[11px] font-normal text-ink-soft">
                          {d.branchName ?? "—"}
                          {d.plates.length > 0 ? ` · ${d.plates.join(", ")}` : " · no vehicle"}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Vehicle *</Label>
              <Select value={vehicleId} onValueChange={setVehicleId} disabled={!driverId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={driverId ? "Select vehicle" : "Pick a driver first"} />
                </SelectTrigger>
                <SelectContent>
                  {selectableVehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      <span className="flex flex-col py-0.5">
                        <span className="font-mono">{v.plateNumber}</span>
                        <span className="text-[11px] font-normal text-ink-soft">
                          {v.label} · {v.branchName} · {fmtNumber(v.currentOdometer)} km
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {vehicle && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-soft">
                  <CarFront className="h-3 w-3" />
                  Last recorded {fmtNumber(vehicle.currentOdometer)} km
                  {vehicle.primaryDriverName ? ` · assigned to ${vehicle.primaryDriverName}` : " · pool vehicle"}
                </p>
              )}
            </div>

            {isTemporary && (
              <div className="rounded-2xl border-2 border-[#e8935e]/50 bg-[#e8935e]/10 p-3">
                <p className="flex items-center gap-1.5 text-[12px] font-bold text-[#7c4211]">
                  <AlertTriangle className="h-3.5 w-3.5" /> Temporary use — purpose required
                </p>
                <Select value={purpose} onValueChange={setPurpose}>
                  <SelectTrigger className="mt-2 border-[#e8935e]/60 bg-white">
                    <SelectValue placeholder="Select trip reason…" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIP_PURPOSES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Entry type</Label>
                <Select value={entryType} onValueChange={setEntryType}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning Start</SelectItem>
                    <SelectItem value="evening">Evening End</SelectItem>
                    <SelectItem value="refuel">Refuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Odometer (km) *</Label>
                <Input
                  inputMode="numeric"
                  value={odo}
                  onChange={(e) => setOdo(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="86420"
                  className="mt-1.5 font-mono font-bold"
                />
              </div>
            </div>

            {entryType === "refuel" && (
              <div className="grid grid-cols-3 gap-2 rounded-2xl border-2 border-dashed border-green/40 bg-green/5 p-3">
                <div>
                  <Label className="flex items-center gap-1"><Fuel className="h-3 w-3" /> Litres *</Label>
                  <Input
                    inputMode="decimal"
                    value={liters}
                    onChange={(e) => setLiters(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="mt-1.5 font-mono"
                  />
                </div>
                <div>
                  <Label>Cost (€) *</Label>
                  <Input
                    inputMode="decimal"
                    value={cost}
                    onChange={(e) => setCost(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="mt-1.5 font-mono"
                  />
                </div>
                <div>
                  <Label>Station</Label>
                  <Input
                    list="manual-stations"
                    value={station}
                    onChange={(e) => setStation(e.target.value)}
                    className="mt-1.5"
                  />
                  <datalist id="manual-stations">
                    {STATIONS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
              </div>
            )}

            <div>
              <Label>Note</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason for the manual entry (optional)"
                className="mt-1.5"
              />
            </div>

            {driver && (
              <p className="flex flex-wrap items-center gap-1.5 rounded-xl bg-navy/4 px-3 py-2 text-[11px] text-ink-soft">
                Will be recorded as
                <Badge variant="blue">{driver.fullName}</Badge>
                {isTemporary && <Badge variant="amber">Temporary use</Badge>}
                · filed by you and written to the audit log
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-xl bg-red/10 px-3.5 py-2.5 text-sm font-semibold text-red">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            File entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
