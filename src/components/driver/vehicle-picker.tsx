"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, CarFront, ChevronDown, Loader2, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtNumber } from "@/lib/format";
import { authFetch } from "@/lib/session-client";
import type { SessionUserDTO, VehicleOption } from "@/lib/types";

export function VehiclePicker({
  user,
  selected,
  onSelect,
}: {
  user: SessionUserDTO;
  selected: VehicleOption | null;
  onSelect: (v: VehicleOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await authFetch(`/api/vehicles?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setVehicles(data.vehicles ?? []);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl border-2 border-navy/12 bg-white/80 p-3.5 text-left shadow-tactile transition-all cursor-pointer hover:border-blue/50",
            open && "border-blue ring-4 ring-blue/10"
          )}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy/6 text-navy/70">
            <CarFront className="h-5.5 w-5.5" />
          </span>
          <span className="min-w-0 flex-1">
            {selected ? (
              <>
                <span className="block font-mono text-[15px] font-bold tracking-wide text-navy">
                  {selected.plateNumber}
                </span>
                <span className="block truncate text-xs text-ink-soft">{selected.label}</span>
              </>
            ) : (
              <span className="text-sm font-medium text-ink-soft">Search company vehicles…</span>
            )}
          </span>
          <ChevronDown className={cn("h-4.5 w-4.5 shrink-0 text-navy/40 transition-transform", open && "rotate-180")} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[calc(100vw-3rem)] max-w-md p-0 sm:w-[420px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b border-navy/8 p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Plate, make or model…"
              className="h-10 w-full rounded-xl bg-cream pl-9 pr-3 text-sm font-medium outline-none placeholder:text-navy/35 focus:ring-2 focus:ring-blue/30"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-soft">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching fleet…
            </div>
          )}
          {!loading && vehicles.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-soft">No vehicles found.</p>
          )}
          {!loading &&
            vehicles.map((v) => {
              const mine = v.primaryDriverId === user.id;
              const active = selected?.id === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    onSelect(v);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors cursor-pointer",
                    active ? "bg-blue/8" : "hover:bg-cream"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold tracking-wide text-navy">
                        {v.plateNumber}
                      </span>
                      {mine && (
                        <Badge variant="green" className="px-1.5 py-0 text-[9px]">
                          <BadgeCheck className="h-2.5 w-2.5" /> Assigned to you
                        </Badge>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-soft">
                      {v.label} · {v.branchName}
                      {v.primaryDriverName && !mine ? ` · Driver: ${v.primaryDriverName}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-mono text-[11px] text-navy/45">
                    {fmtNumber(v.currentOdometer)} km
                  </span>
                </button>
              );
            })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
