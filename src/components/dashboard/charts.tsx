"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS } from "@/lib/constants";
import { fmtEuro, fmtNumber } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";

const AXIS_STYLE = { fontSize: 11, fill: "#585d8f", fontWeight: 600 } as const;

function TooltipShell({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-white px-3.5 py-2.5 shadow-lift">
      {label && <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-navy/50">{label}</p>}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stacked km chart                                                    */
/* ------------------------------------------------------------------ */

export function KmStackedChart({ data }: { data: DashboardStats["kmByBranch"] }) {
  const rows = data.months.map((m, i) => ({
    month: m,
    ...Object.fromEntries(data.series.map((s) => [s.name, s.values[i] ?? 0])),
  }));

  return (
    <div className="h-[240px] w-full sm:h-[290px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, left: -14, bottom: 0 }} barCategoryGap="24%">
        <CartesianGrid strokeDasharray="3 6" stroke="#21264e14" vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={AXIS_STYLE} dy={6} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={AXIS_STYLE}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
        />
        <Tooltip
          cursor={{ fill: "#21264e08", radius: 8 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipShell label={label == null ? undefined : String(label)}>
                <div className="max-h-44 space-y-1 overflow-y-auto">
                  {[...payload]
                    .sort((a, b) => Number(b.value) - Number(a.value))
                    .filter((p) => Number(p.value) > 0)
                    .map((p) => (
                      <p key={String(p.dataKey)} className="flex items-center gap-2 text-xs font-semibold text-navy">
                        <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: p.color as string }} />
                        <span className="min-w-16">{p.name}</span>
                        <span className="ml-auto font-mono">{fmtNumber(Number(p.value))} km</span>
                      </p>
                    ))}
                </div>
              </TooltipShell>
            ) : null
          }
        />
        {data.series.map((s, i) => (
          <Bar
            key={s.name}
            dataKey={s.name}
            stackId="km"
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            radius={i === data.series.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
            maxBarSize={34}
          />
        ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Efficiency line                                                     */
/* ------------------------------------------------------------------ */

export function EfficiencyChart({ data }: { data: DashboardStats["efficiencyTrend"] }) {
  const rows = data.filter((d) => d.kmPerLiter != null);
  return (
    <div className="h-[240px] w-full sm:h-[290px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 6" stroke="#21264e14" vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={AXIS_STYLE} dy={6} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={AXIS_STYLE}
          domain={["dataMin - 1", "dataMax + 1"]}
          tickFormatter={(v: number) => v.toFixed(1)}
        />
        <Tooltip
          cursor={{ stroke: "#21264e22" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipShell label={label == null ? undefined : String(label)}>
                <p className="text-xs font-semibold text-navy">
                  Fleet average{" "}
                  <span className="font-mono text-green-deep">{Number(payload[0].value).toFixed(2)} km/L</span>
                </p>
              </TooltipShell>
            ) : null
          }
        />
        <Line
          type="monotone"
          dataKey="kmPerLiter"
          stroke="#08dc7d"
          strokeWidth={3}
          dot={{ r: 4, fill: "#21264e", stroke: "#08dc7d", strokeWidth: 2 }}
          activeDot={{ r: 6, fill: "#08dc7d", stroke: "#21264e", strokeWidth: 2 }}
        />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fuel spend horizontal bars                                          */
/* ------------------------------------------------------------------ */

export function FuelSpendChart({ data }: { data: DashboardStats["fuelByBranch"] }) {
  return (
    <div className="h-[250px] w-full sm:h-[290px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barCategoryGap="18%">
        <CartesianGrid strokeDasharray="3 6" stroke="#21264e14" horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={{ ...AXIS_STYLE, fontSize: 10 }}
          width={72}
        />
        <Tooltip
          cursor={{ fill: "#21264e08", radius: 8 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipShell label={String(label)}>
                <p className="text-xs font-semibold text-navy">
                  Fuel spend <span className="font-mono text-blue">{fmtEuro(Number(payload[0].value))}</span>
                </p>
              </TooltipShell>
            ) : null
          }
        />
        <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={22}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v) => fmtEuro(Number(v))}
            style={{ fontSize: 11, fontWeight: 700, fill: "#585d8f", fontFamily: "var(--font-plex)" }}
          />
        </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Log mix donut                                                       */
/* ------------------------------------------------------------------ */

export function LogMixChart({ data }: { data: DashboardStats["typeSplit"] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative h-[240px] w-full sm:h-[290px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data.filter((d) => d.value > 0)}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={3}
            strokeWidth={0}
            cornerRadius={6}
          >
            {data
              .filter((d) => d.value > 0)
              .map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipShell>
                  <p className="flex items-center gap-2 text-xs font-semibold text-navy">
                    <span
                      className="h-2.5 w-2.5 rounded-[4px]"
                      style={{ background: (payload[0].payload as { color: string }).color }}
                    />
                    {payload[0].name}
                    <span className="ml-2 font-mono">{fmtNumber(Number(payload[0].value))}</span>
                  </p>
                </TooltipShell>
              ) : null
            }
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-display text-3xl font-bold text-navy">{fmtNumber(total)}</p>
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft/70">logs this month</p>
      </div>
    </div>
  );
}
