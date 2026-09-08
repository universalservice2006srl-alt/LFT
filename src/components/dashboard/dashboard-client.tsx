"use client";

import { motion } from "framer-motion";
import { BarChart3, Building2, Fuel, GaugeCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { LogsExplorer } from "@/components/dashboard/logs-explorer";
import {
  EfficiencyChart,
  FuelSpendChart,
  KmStackedChart,
  LogMixChart,
} from "@/components/dashboard/charts";
import { fmtKm } from "@/lib/format";
import type { BranchDTO, DashboardStats, SessionUserDTO } from "@/lib/types";

const rise = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};

export function DashboardClient({
  user,
  stats,
  branches,
}: {
  user: SessionUserDTO;
  stats: DashboardStats;
  branches: BranchDTO[];
}) {
  const isAdmin = user.role === "super_admin";

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      {/* ------------------------------- Header ------------------------------- */}
      <motion.div {...rise} transition={{ duration: 0.5 }} className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-navy/45 sm:text-[11px] sm:tracking-[0.22em]">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{isAdmin ? "Company-wide · all 8 branches" : `${user.branchName} branch · scoped view`}</span>
          </p>
          <h1 className="mt-1.5 font-display text-[28px] font-bold leading-tight tracking-tight text-navy sm:mt-2 sm:text-[40px] sm:leading-none">
            Operations dashboard
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-ink-soft sm:mt-2 sm:text-sm">
            {isAdmin
              ? "Live fleet activity, fuel economics and temporary-driver auditing across Lyca Mobile."
              : `Operational oversight for vehicles and drivers assigned to ${user.branchName}.`}
          </p>
        </div>
        <div className="flex w-full min-w-0 items-center gap-2 rounded-2xl border border-navy/10 bg-white/70 px-3.5 py-2.5 shadow-tactile sm:w-auto sm:px-4">
          <GaugeCircle className="h-4.5 w-4.5 text-green-deep" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-navy/45">Fleet efficiency</p>
            <p className="truncate font-mono text-xs font-bold text-navy sm:text-sm">
              {stats.kpis.avgKmPerLiter ? `${stats.kpis.avgKmPerLiter.toFixed(2)} km/L` : "—"} · {fmtKm(stats.kpis.fleetKmMonth)} MTD
            </p>
          </div>
        </div>
      </motion.div>

      {/* -------------------------------- KPIs -------------------------------- */}
      <motion.div {...rise} transition={{ duration: 0.5, delay: 0.06 }}>
        <KpiCards stats={stats} />
      </motion.div>

      {/* ------------------------------- Charts ------------------------------- */}
      <div className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-2">
        <motion.div {...rise} transition={{ duration: 0.5, delay: 0.1 }} className="min-w-0">
          <Card className="min-w-0 overflow-hidden rounded-2xl sm:rounded-3xl">
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 p-4 sm:flex-nowrap sm:p-6">
              <div>
                <CardTitle>Monthly kilometres</CardTitle>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {isAdmin ? "Stacked by branch · last 6 months" : "Stacked by top drivers · last 6 months"}
                </p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue/10 text-blue">
                <BarChart3 className="h-4.5 w-4.5" />
              </span>
            </CardHeader>
            <CardContent>
              <KmStackedChart data={stats.kmByBranch} />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...rise} transition={{ duration: 0.5, delay: 0.14 }} className="min-w-0">
          <Card className="min-w-0 overflow-hidden rounded-2xl sm:rounded-3xl">
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 p-4 sm:flex-nowrap sm:p-6">
              <div>
                <CardTitle>Fuel efficiency trend</CardTitle>
                <p className="mt-0.5 text-xs text-ink-soft">Fleet-wide km per litre, monthly</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green/15 text-green-deep">
                <GaugeCircle className="h-4.5 w-4.5" />
              </span>
            </CardHeader>
            <CardContent className="px-1 pb-3 sm:px-6 sm:pb-6">
              <EfficiencyChart data={stats.efficiencyTrend} />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...rise} transition={{ duration: 0.5, delay: 0.18 }} className="min-w-0">
          <Card className="min-w-0 overflow-hidden rounded-2xl sm:rounded-3xl">
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 p-4 sm:flex-nowrap sm:p-6">
              <div>
                <CardTitle>Fuel spend · current month</CardTitle>
                <p className="mt-0.5 text-xs text-ink-soft">{isAdmin ? "Per branch office" : "Per driver"}</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow/40 text-[#8a6210]">
                <Fuel className="h-4.5 w-4.5" />
              </span>
            </CardHeader>
            <CardContent className="px-0 pb-3 sm:px-6 sm:pb-6">
              <FuelSpendChart data={stats.fuelByBranch} />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...rise} transition={{ duration: 0.5, delay: 0.22 }} className="min-w-0">
          <Card className="min-w-0 overflow-hidden rounded-2xl sm:rounded-3xl">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle>Entry mix</CardTitle>
              <p className="mt-0.5 text-xs text-ink-soft">Log volume by type · current month</p>
            </CardHeader>
            <CardContent className="px-1 pb-3 sm:px-6 sm:pb-6">
              <LogMixChart data={stats.typeSplit} />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ------------------------------- Table -------------------------------- */}
      <motion.div {...rise} transition={{ duration: 0.5, delay: 0.26 }}>
        <LogsExplorer user={user} branches={branches} />
      </motion.div>
    </div>
  );
}
