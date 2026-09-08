import { CarFront, Fuel, Route, Shuffle, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtEuro, fmtNumber } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";

function Trend({ pct, invert }: { pct: number; invert?: boolean }) {
  const positive = invert ? pct <= 0 : pct >= 0;
  const Icon = pct >= 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
        positive ? "bg-green/15 text-green-deep" : "bg-red/10 text-red"
      )}
    >
      <Icon className="h-3 w-3" />
      {pct >= 0 ? "+" : ""}
      {fmtNumber(pct)}%
    </span>
  );
}

export function KpiCards({ stats }: { stats: DashboardStats }) {
  const k = stats.kpis;
  const items = [
    {
      label: "Active fleet",
      value: String(k.activeFleet),
      sub: `${k.vehiclesTotal} vehicles total`,
      icon: CarFront,
      chip: "bg-blue/12 text-blue",
      trend: null as React.ReactNode,
    },
    {
      label: "Km logged today",
      value: fmtNumber(k.kmToday),
      sub: "vs 7-day daily average",
      icon: Route,
      chip: "bg-green/15 text-green-deep",
      trend: <Trend pct={k.kmTrendPct} />,
    },
    {
      label: "Fuel spend · month",
      value: fmtEuro(k.fuelSpendMonth),
      sub: "vs previous month",
      icon: Fuel,
      chip: "bg-yellow/40 text-[#8a6210]",
      trend: <Trend pct={k.fuelTrendPct} invert />,
    },
    {
      label: "Temporary-driver logs",
      value: String(k.tempLogsMonth),
      sub: `${k.pendingReview} entries awaiting review`,
      icon: Shuffle,
      chip: "bg-[#e8935e]/15 text-[#a95a1d]",
      trend: null,
    },
  ];

  return (
    <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="group relative min-w-0 overflow-hidden rounded-2xl p-3.5 sm:rounded-3xl sm:p-5">
          <div className="flex min-w-0 items-start justify-between gap-1.5 sm:gap-2">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 sm:h-10 sm:w-10", item.chip)}>
              <item.icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </span>
            <span className="scale-90 origin-top-right sm:scale-100">{item.trend}</span>
          </div>
          <p className="mt-3 truncate font-display text-[clamp(1.18rem,6vw,1.6rem)] font-bold leading-none tracking-tight text-navy sm:mt-4 sm:text-3xl">
            {item.value}
          </p>
          <p className="mt-1.5 min-h-8 text-[11px] font-semibold leading-tight text-navy/70 sm:min-h-0 sm:text-[13px]">
            {item.label}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-ink-soft/80 sm:text-[11px]">
            {item.sub}
          </p>
        </Card>
      ))}
    </div>
  );
}
