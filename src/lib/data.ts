import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  auditLogs,
  branches,
  mileageLogs,
  profiles,
  refuelLogs,
  vehicles,
} from "@/db/schema";
import type {
  AuditLog,
  Branch,
  Profile,
  RefuelLog,
  Vehicle,
} from "@/db/schema";
import type {
  BranchDTO,
  DashboardStats,
  LogRow,
  SessionUserDTO,
  VehicleOption,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Scoping                                                             */
/* ------------------------------------------------------------------ */

type Scope =
  | { kind: "all" }
  | { kind: "branch"; branchId: string }
  | { kind: "driver"; driverId: string };

export function scopeFor(user: SessionUserDTO): Scope {
  if (user.role === "super_admin") return { kind: "all" };
  if (user.role === "branch_manager" && user.branchId)
    return { kind: "branch", branchId: user.branchId };
  return { kind: "driver", driverId: user.id };
}

/* ------------------------------------------------------------------ */
/* Logs                                                                */
/* ------------------------------------------------------------------ */

export type LogFilters = {
  branchId?: string | null;
  entryType?: string | null;
  usage?: "assigned" | "temporary" | null;
  status?: string | null;
  q?: string | null;
  from?: string | null;
  to?: string | null;
  driverId?: string | null;
  page?: number;
  limit?: number;
};

function logConditions(user: SessionUserDTO, f: LogFilters): SQL[] {
  const scope = scopeFor(user);
  const conds: SQL[] = [];
  if (scope.kind === "branch") conds.push(eq(mileageLogs.branchId, scope.branchId));
  if (scope.kind === "driver") conds.push(eq(mileageLogs.driverId, scope.driverId));

  if (scope.kind === "all" && f.branchId)
    conds.push(eq(mileageLogs.branchId, f.branchId));
  if (f.driverId) conds.push(eq(mileageLogs.driverId, f.driverId));
  if (f.entryType && ["morning", "evening", "refuel"].includes(f.entryType))
    conds.push(eq(mileageLogs.entryType, f.entryType as never));
  if (f.usage === "temporary") conds.push(eq(mileageLogs.isTemporaryDriver, true));
  if (f.usage === "assigned") conds.push(eq(mileageLogs.isTemporaryDriver, false));
  if (f.status && ["pending", "approved", "flagged"].includes(f.status))
    conds.push(eq(mileageLogs.status, f.status as never));
  if (f.from) conds.push(gte(mileageLogs.createdAt, new Date(f.from)));
  if (f.to) {
    const to = new Date(f.to);
    to.setHours(23, 59, 59, 999);
    conds.push(lte(mileageLogs.createdAt, to));
  }
  if (f.q && f.q.trim()) {
    const needle = `%${f.q.trim()}%`;
    conds.push(
      or(
        ilike(profiles.fullName, needle),
        ilike(vehicles.plateNumber, needle),
        ilike(vehicles.model, needle)
      )!
    );
  }
  return conds;
}

/** aliased profile join so we can resolve the reviewing manager's name */
const reviewerProfile = alias(profiles, "reviewer_profile");

const logSelect = {
  id: mileageLogs.id,
  createdAt: mileageLogs.createdAt,
  entryType: mileageLogs.entryType,
  odometerValue: mileageLogs.odometerValue,
  distanceKm: mileageLogs.distanceKm,
  isTemporaryDriver: mileageLogs.isTemporaryDriver,
  tripPurpose: mileageLogs.tripPurpose,
  status: mileageLogs.status,
  photoUrl: mileageLogs.photoUrl,
  locationLat: mileageLogs.locationLat,
  locationLng: mileageLogs.locationLng,
  note: mileageLogs.note,
  driverId: mileageLogs.driverId,
  driverName: profiles.fullName,
  driverColor: profiles.avatarColor,
  vehicleId: mileageLogs.vehicleId,
  plate: vehicles.plateNumber,
  vehicleMake: vehicles.make,
  vehicleModel: vehicles.model,
  branchId: mileageLogs.branchId,
  branchName: branches.name,
  reviewedAt: mileageLogs.reviewedAt,
  reviewerName: reviewerProfile.fullName,
  reviewerRole: reviewerProfile.role,
  refuelId: refuelLogs.id,
  rLiters: refuelLogs.liters,
  rTotalCost: refuelLogs.totalCost,
  rPpl: refuelLogs.pricePerLiter,
  rStation: refuelLogs.stationName,
  rReceipt: refuelLogs.receiptUrl,
};

function logQueryBase() {
  return db
    .select(logSelect)
    .from(mileageLogs)
    .innerJoin(profiles, eq(profiles.id, mileageLogs.driverId))
    .innerJoin(vehicles, eq(vehicles.id, mileageLogs.vehicleId))
    .innerJoin(branches, eq(branches.id, mileageLogs.branchId))
    .leftJoin(reviewerProfile, eq(reviewerProfile.id, mileageLogs.reviewedBy))
    .leftJoin(refuelLogs, eq(refuelLogs.mileageLogId, mileageLogs.id));
}

function toLogRow(r: Awaited<ReturnType<typeof logQueryBase>>[number]): LogRow {
  return {
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    entryType: r.entryType,
    odometerValue: r.odometerValue,
    distanceKm: r.distanceKm,
    isTemporaryDriver: r.isTemporaryDriver,
    tripPurpose: r.tripPurpose,
    status: r.status,
    photoUrl: r.photoUrl,
    locationLat: r.locationLat,
    locationLng: r.locationLng,
    note: r.note,
    driverId: r.driverId,
    driverName: r.driverName,
    driverColor: r.driverColor,
    vehicleId: r.vehicleId,
    plate: r.plate,
    vehicleLabel: `${r.vehicleMake} ${r.vehicleModel}`,
    branchId: r.branchId,
    branchName: r.branchName,
    reviewerName: r.reviewerName,
    reviewerRole: r.reviewerRole,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    refuel: r.refuelId
      ? {
          liters: r.rLiters!,
          totalCost: r.rTotalCost!,
          pricePerLiter: r.rPpl,
          stationName: r.rStation,
          receiptUrl: r.rReceipt,
        }
      : null,
  };
}

export async function listLogs(user: SessionUserDTO, f: LogFilters) {
  const conds = logConditions(user, f);
  const page = Math.max(1, f.page ?? 1);
  const limit = Math.min(100, Math.max(5, f.limit ?? 15));

  const rows = await logQueryBase()
    .where(and(...conds))
    .orderBy(desc(mileageLogs.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mileageLogs)
    .innerJoin(profiles, eq(profiles.id, mileageLogs.driverId))
    .innerJoin(vehicles, eq(vehicles.id, mileageLogs.vehicleId))
    .innerJoin(branches, eq(branches.id, mileageLogs.branchId))
    .where(and(...conds));

  const total = countRows[0]?.count ?? 0;
  return {
    rows: rows.map(toLogRow),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function listAllLogsForExport(user: SessionUserDTO, f: LogFilters) {
  const conds = logConditions(user, f);
  const rows = await logQueryBase()
    .where(and(...conds))
    .orderBy(desc(mileageLogs.createdAt))
    .limit(10000);
  return rows.map(toLogRow);
}

export async function listMyRecentLogs(user: SessionUserDTO, limit = 14) {
  const rows = await logQueryBase()
    .where(eq(mileageLogs.driverId, user.id))
    .orderBy(desc(mileageLogs.createdAt))
    .limit(limit);
  return rows.map(toLogRow);
}

/* ------------------------------------------------------------------ */
/* Vehicles                                                            */
/* ------------------------------------------------------------------ */

export async function listVehicleOptions(
  user: SessionUserDTO,
  query?: string | null
): Promise<VehicleOption[]> {
  const conds: SQL[] = [eq(vehicles.status, "active")];
  if (query && query.trim()) {
    const needle = `%${query.trim()}%`;
    conds.push(
      or(
        ilike(vehicles.plateNumber, needle),
        ilike(vehicles.model, needle),
        ilike(vehicles.make, needle)
      )!
    );
  }
  const rows = await db
    .select({
      id: vehicles.id,
      plateNumber: vehicles.plateNumber,
      make: vehicles.make,
      model: vehicles.model,
      year: vehicles.year,
      branchId: vehicles.branchId,
      branchName: branches.name,
      status: vehicles.status,
      primaryDriverId: vehicles.primaryDriverId,
      primaryDriverName: profiles.fullName,
      currentOdometer: vehicles.currentOdometer,
    })
    .from(vehicles)
    .innerJoin(branches, eq(branches.id, vehicles.branchId))
    .leftJoin(profiles, eq(profiles.id, vehicles.primaryDriverId))
    .where(and(...conds))
    .orderBy(asc(vehicles.plateNumber))
    .limit(60);

  // own branch first for nicer picker UX
  return rows
    .map((v) => ({
      id: v.id,
      plateNumber: v.plateNumber,
      label: `${v.make} ${v.model} · ${v.year}`,
      make: v.make,
      model: v.model,
      branchId: v.branchId,
      branchName: v.branchName,
      status: v.status,
      primaryDriverId: v.primaryDriverId,
      primaryDriverName: v.primaryDriverName,
      currentOdometer: v.currentOdometer,
    }))
    .sort((a, b) => {
      const ab = a.branchId === user.branchId ? 0 : 1;
      const bb = b.branchId === user.branchId ? 0 : 1;
      return ab - bb || a.plateNumber.localeCompare(b.plateNumber);
    });
}

export type FleetRow = {
  vehicle: Vehicle;
  branchName: string;
  primaryDriverName: string | null;
  primaryDriverId: string | null;
  kmMonth: number;
  litersMonth: number;
  lastLogAt: string | null;
};

export async function listFleet(user: SessionUserDTO): Promise<FleetRow[]> {
  const scope = scopeFor(user);
  const conds: SQL[] = [];
  if (scope.kind === "branch") conds.push(eq(vehicles.branchId, scope.branchId));

  const rows = await db
    .select({
      vehicle: vehicles,
      branchName: branches.name,
      primaryDriverName: profiles.fullName,
    })
    .from(vehicles)
    .innerJoin(branches, eq(branches.id, vehicles.branchId))
    .leftJoin(profiles, eq(profiles.id, vehicles.primaryDriverId))
    .where(and(...conds))
    .orderBy(asc(branches.name), asc(vehicles.plateNumber));

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const usageRows = await db
    .select({
      vehicleId: mileageLogs.vehicleId,
      km: sql<number>`coalesce(sum(${mileageLogs.distanceKm}),0)::int`,
      lastLogAt: sql<string | null>`max(${mileageLogs.createdAt})`,
    })
    .from(mileageLogs)
    .where(and(gte(mileageLogs.createdAt, monthStart), ...(scope.kind === "branch" ? [eq(mileageLogs.branchId, scope.branchId)] : [])))
    .groupBy(mileageLogs.vehicleId);

  const litersRows = await db
    .select({
      vehicleId: mileageLogs.vehicleId,
      liters: sql<number>`coalesce(sum(${refuelLogs.liters}),0)::float`,
    })
    .from(refuelLogs)
    .innerJoin(mileageLogs, eq(mileageLogs.id, refuelLogs.mileageLogId))
    .where(and(gte(refuelLogs.createdAt, monthStart), ...(scope.kind === "branch" ? [eq(mileageLogs.branchId, scope.branchId)] : [])))
    .groupBy(mileageLogs.vehicleId);

  const kmMap = new Map(usageRows.map((r) => [r.vehicleId, r]));
  const lMap = new Map(litersRows.map((r) => [r.vehicleId, r.liters]));

  return rows.map((r) => ({
    vehicle: r.vehicle,
    branchName: r.branchName,
    primaryDriverName: r.primaryDriverName,
    primaryDriverId: r.vehicle.primaryDriverId,
    kmMonth: kmMap.get(r.vehicle.id)?.km ?? 0,
    litersMonth: lMap.get(r.vehicle.id) ?? 0,
    lastLogAt: kmMap.get(r.vehicle.id)?.lastLogAt ?? null,
  }));
}

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

/** Profile without any credential material — safe to send to the client. */
export type PersonRow = Omit<Profile, "passwordHash" | "passwordPlain"> & {
  branchName: string | null;
  vehiclePlates: string[];
  logCount: number;
};

export async function listPeople(user: SessionUserDTO): Promise<PersonRow[]> {
  const scope = scopeFor(user);
  const conds: SQL[] = [];
  if (scope.kind === "branch") conds.push(eq(profiles.branchId, scope.branchId));

  const rows = await db
    .select({ profile: profiles, branchName: branches.name })
    .from(profiles)
    .leftJoin(branches, eq(branches.id, profiles.branchId))
    .where(and(...conds))
    .orderBy(asc(profiles.role), asc(profiles.fullName));

  const assigned = await db
    .select({
      primaryDriverId: vehicles.primaryDriverId,
      plateNumber: vehicles.plateNumber,
    })
    .from(vehicles)
    .where(isNotNull(vehicles.primaryDriverId));

  const plateMap = new Map<string, string[]>();
  for (const a of assigned) {
    if (!a.primaryDriverId) continue;
    const arr = plateMap.get(a.primaryDriverId) ?? [];
    arr.push(a.plateNumber);
    plateMap.set(a.primaryDriverId, arr);
  }

  const logCounts = await db
    .select({
      driverId: mileageLogs.driverId,
      n: sql<number>`count(*)::int`,
    })
    .from(mileageLogs)
    .groupBy(mileageLogs.driverId);
  const logMap = new Map(logCounts.map((l) => [l.driverId, l.n]));

  return rows.map((r) => {
    // Never leak credential columns to the client.
    const { passwordHash: _h, passwordPlain: _p, ...safe } = r.profile;
    void _h;
    void _p;
    return {
      ...safe,
      branchName: r.branchName,
      vehiclePlates: plateMap.get(r.profile.id) ?? [],
      logCount: logMap.get(r.profile.id) ?? 0,
    };
  });
}

export async function listBranches(): Promise<BranchDTO[]> {
  const rows = await db.select().from(branches).orderBy(asc(branches.name));
  return rows.map((b) => ({ id: b.id, name: b.name, code: b.code }));
}

/* ------------------------------------------------------------------ */
/* Dashboard stats                                                     */
/* ------------------------------------------------------------------ */

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function getDashboardStats(user: SessionUserDTO): Promise<DashboardStats> {
  const scope = scopeFor(user);
  const branchCond: SQL[] =
    scope.kind === "branch" ? [eq(mileageLogs.branchId, scope.branchId)] : [];

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  // ---- fleet counts ----
  const fleetConds: SQL[] = [];
  if (scope.kind === "branch") fleetConds.push(eq(vehicles.branchId, scope.branchId));
  const fleetRows = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${vehicles.status} = 'active')::int`,
    })
    .from(vehicles)
    .where(and(...fleetConds));
  const vehiclesTotal = fleetRows[0]?.total ?? 0;
  const activeFleet = fleetRows[0]?.active ?? 0;

  // ---- logs in last 6 months ----
  const logRows = await db
    .select({
      createdAt: mileageLogs.createdAt,
      distanceKm: mileageLogs.distanceKm,
      entryType: mileageLogs.entryType,
      isTemporaryDriver: mileageLogs.isTemporaryDriver,
      status: mileageLogs.status,
      branchId: mileageLogs.branchId,
      driverId: mileageLogs.driverId,
      driverName: profiles.fullName,
      branchName: branches.name,
    })
    .from(mileageLogs)
    .innerJoin(profiles, eq(profiles.id, mileageLogs.driverId))
    .innerJoin(branches, eq(branches.id, mileageLogs.branchId))
    .where(and(gte(mileageLogs.createdAt, sixMonthsAgo), ...branchCond));

  // ---- refuels in last 6 months ----
  const refuelRows = await db
    .select({
      createdAt: refuelLogs.createdAt,
      liters: sql<number>`${refuelLogs.liters}::float`,
      cost: sql<number>`${refuelLogs.totalCost}::float`,
      branchName: branches.name,
      driverName: profiles.fullName,
    })
    .from(refuelLogs)
    .innerJoin(mileageLogs, eq(mileageLogs.id, refuelLogs.mileageLogId))
    .innerJoin(branches, eq(branches.id, mileageLogs.branchId))
    .innerJoin(profiles, eq(profiles.id, mileageLogs.driverId))
    .where(and(gte(refuelLogs.createdAt, sixMonthsAgo), ...branchCond));

  const now = new Date();
  const todayKey = now.toDateString();
  const thisMonth = monthKey(now);
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = monthKey(prevMonthDate);

  const kmToday = logRows
    .filter((l) => l.createdAt.toDateString() === todayKey)
    .reduce((s, l) => s + l.distanceKm, 0);

  // 7-day average excluding today
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const kmLast7 = logRows
    .filter((l) => l.createdAt >= sevenDaysAgo && l.createdAt.toDateString() !== todayKey)
    .reduce((s, l) => s + l.distanceKm, 0);
  const dailyAvg = kmLast7 / 7;
  const kmTrendPct = dailyAvg > 0 ? ((kmToday - dailyAvg) / dailyAvg) * 100 : 0;

  const kmMonth = logRows
    .filter((l) => monthKey(l.createdAt) === thisMonth)
    .reduce((s, l) => s + l.distanceKm, 0);

  const fuelMonth = refuelRows
    .filter((r) => monthKey(r.createdAt) === thisMonth)
    .reduce((s, r) => s + r.cost, 0);
  const fuelPrev = refuelRows
    .filter((r) => monthKey(r.createdAt) === prevMonth)
    .reduce((s, r) => s + r.cost, 0);
  const fuelTrendPct = fuelPrev > 0 ? ((fuelMonth - fuelPrev) / fuelPrev) * 100 : 0;

  const tempMonth = logRows.filter(
    (l) => l.isTemporaryDriver && monthKey(l.createdAt) === thisMonth
  ).length;
  const pending = logRows.filter((l) => l.status === "pending").length;

  const litersMonth = refuelRows
    .filter((r) => monthKey(r.createdAt) === thisMonth)
    .reduce((s, r) => s + r.liters, 0);
  const avgKmPerLiter = litersMonth > 0 ? kmMonth / litersMonth : null;

  // ---- km by branch (or by driver for branch scope) ----
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(MONTH_LABELS[d.getMonth()]);
  }
  const monthKeysArr: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeysArr.push(monthKey(d));
  }

  const groupField = scope.kind === "all" ? ("branchName" as const) : ("driverName" as const);
  const totalsByGroup = new Map<string, number>();
  for (const l of logRows) {
    const g = l[groupField];
    totalsByGroup.set(g, (totalsByGroup.get(g) ?? 0) + l.distanceKm);
  }
  let groups = [...totalsByGroup.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  if (scope.kind !== "all") groups = groups.slice(0, 6); // top 6 drivers

  const series = groups.map((name) => ({
    name,
    values: monthKeysArr.map((mk) =>
      logRows
        .filter((l) => l[groupField] === name && monthKey(l.createdAt) === mk)
        .reduce((s, l) => s + l.distanceKm, 0)
    ),
  }));

  // ---- efficiency trend ----
  const efficiencyTrend = monthKeysArr.map((mk, i) => {
    const km = logRows
      .filter((l) => monthKey(l.createdAt) === mk)
      .reduce((s, l) => s + l.distanceKm, 0);
    const ltrs = refuelRows
      .filter((r) => monthKey(r.createdAt) === mk)
      .reduce((s, r) => s + r.liters, 0);
    return {
      month: months[i],
      kmPerLiter: ltrs > 0 ? Math.round((km / ltrs) * 100) / 100 : null,
    };
  });

  // ---- fuel by branch / driver (this month) ----
  const fuelGroupField = scope.kind === "all" ? "branchName" : "driverName";
  const fuelMap = new Map<string, number>();
  for (const r of refuelRows) {
    if (monthKey(r.createdAt) !== thisMonth) continue;
    const g = r[fuelGroupField as "branchName" | "driverName"];
    fuelMap.set(g, (fuelMap.get(g) ?? 0) + r.cost);
  }
  const fuelByBranch = [...fuelMap.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // ---- entry type split (this month) ----
  const monthLogs = logRows.filter((l) => monthKey(l.createdAt) === thisMonth);
  const typeSplit = [
    { name: "Morning", value: monthLogs.filter((l) => l.entryType === "morning").length, color: "#245bc1" },
    { name: "Evening", value: monthLogs.filter((l) => l.entryType === "evening").length, color: "#46286E" },
    { name: "Refuel", value: monthLogs.filter((l) => l.entryType === "refuel").length, color: "#08dc7d" },
    { name: "Temp. driver", value: monthLogs.filter((l) => l.isTemporaryDriver).length, color: "#e8935e" },
  ];

  return {
    kpis: {
      activeFleet,
      vehiclesTotal,
      kmToday,
      kmTrendPct: Math.round(kmTrendPct * 10) / 10,
      fuelSpendMonth: Math.round(fuelMonth),
      fuelTrendPct: Math.round(fuelTrendPct * 10) / 10,
      tempLogsMonth: tempMonth,
      pendingReview: pending,
      fleetKmMonth: kmMonth,
      avgKmPerLiter: avgKmPerLiter ? Math.round(avgKmPerLiter * 100) / 100 : null,
    },
    kmByBranch: { months, series },
    efficiencyTrend,
    fuelByBranch,
    typeSplit,
  };
}

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export type AuditRow = AuditLog & { actorName: string | null; branchName: string | null };

export async function listAudit(limit = 80, user?: SessionUserDTO): Promise<AuditRow[]> {
  // Office managers only see trail entries for their own branch.
  const conds: SQL[] =
    user && user.role === "branch_manager" && user.branchId
      ? [eq(auditLogs.branchId, user.branchId)]
      : [];

  const rows = await db
    .select({
      audit: auditLogs,
      actorName: profiles.fullName,
      branchName: branches.name,
    })
    .from(auditLogs)
    .leftJoin(profiles, eq(profiles.id, auditLogs.actorId))
    .leftJoin(branches, eq(branches.id, auditLogs.branchId))
    .where(and(...conds))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    ...r.audit,
    actorName: r.actorName,
    branchName: r.branchName,
  }));
}

export async function writeAudit(entry: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  branchId?: string | null;
  details?: string | null;
}) {
  await db.insert(auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    branchId: entry.branchId ?? null,
    details: entry.details ?? null,
  });
}

/* ------------------------------------------------------------------ */
/* Vehicle daily reconciliation report                                 */
/* ------------------------------------------------------------------ */

export type VehicleDailyRow = {
  date: string; // YYYY-MM-DD
  vehicleId: string;
  plate: string;
  vehicleLabel: string;
  branchId: string;
  branchName: string;
  assignedStaff: string | null;
  loggedBy: string[];
  morningKm: number | null;
  eveningKm: number | null;
  totalKm: number | null;
  refuelCost: number;
  refuelLiters: number;
  refuelCount: number;
  status: "logged" | "partial" | "not_used";
  /** unreported distance detected against the previous known reading */
  gapKm: number;
  mismatch: string | null;
  /** ok = reconciled · info = idle, nothing to explain · alert = must be checked */
  severity: "ok" | "info" | "alert";
  temporaryUse: boolean;
  /** ids of the underlying entries so managers can review straight from here */
  logIds: string[];
  /** worst status across the day's entries */
  reviewStatus: "pending" | "approved" | "flagged" | null;
};

export type VehicleDailyReport = {
  rows: VehicleDailyRow[];
  summary: {
    from: string;
    to: string;
    days: number;
    vehicles: number;
    rowCount: number;
    totalKm: number;
    totalCost: number;
    totalLiters: number;
    loggedDays: number;
    partialDays: number;
    notUsedDays: number;
    mismatchDays: number;
    unloggedKm: number;
  };
};

export type VehicleDailyFilters = {
  from?: string | null;
  to?: string | null;
  branchId?: string | null;
  vehicleId?: string | null;
  q?: string | null;
  /** only rows needing attention: mismatch, partial or not used */
  issuesOnly?: boolean;
};

/** UTC day key — logs are recorded 07:00–19:00 so no midnight drift. */
function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export async function getVehicleDailyReport(
  user: SessionUserDTO,
  f: VehicleDailyFilters
): Promise<VehicleDailyReport> {
  const scope = scopeFor(user);

  /* ---------------- date range (default: last 7 days) ---------------- */
  const today = new Date();
  const toDate = f.to ? new Date(`${f.to}T23:59:59.999Z`) : new Date(`${dayKey(today)}T23:59:59.999Z`);
  const defaultFrom = addDays(new Date(`${dayKey(toDate)}T00:00:00.000Z`), -6);
  const fromDate = f.from
    ? new Date(`${f.from}T00:00:00.000Z`)
    : defaultFrom;

  // Guard against absurd ranges (max 92 days keeps the grid bounded).
  const maxSpanMs = 92 * 86400000;
  const startDate =
    toDate.getTime() - fromDate.getTime() > maxSpanMs
      ? new Date(toDate.getTime() - maxSpanMs)
      : fromDate;

  /* ---------------- vehicles in scope ---------------- */
  const vehicleConds: SQL[] = [];
  if (scope.kind === "branch") vehicleConds.push(eq(vehicles.branchId, scope.branchId));
  if (scope.kind === "all" && f.branchId) vehicleConds.push(eq(vehicles.branchId, f.branchId));
  if (f.vehicleId) vehicleConds.push(eq(vehicles.id, f.vehicleId));
  if (f.q && f.q.trim()) {
    const needle = `%${f.q.trim()}%`;
    vehicleConds.push(
      or(
        ilike(vehicles.plateNumber, needle),
        ilike(vehicles.make, needle),
        ilike(vehicles.model, needle),
        ilike(profiles.fullName, needle)
      )!
    );
  }

  const vehicleRows = await db
    .select({
      id: vehicles.id,
      plateNumber: vehicles.plateNumber,
      make: vehicles.make,
      model: vehicles.model,
      status: vehicles.status,
      branchId: vehicles.branchId,
      branchName: branches.name,
      assignedStaff: profiles.fullName,
    })
    .from(vehicles)
    .innerJoin(branches, eq(branches.id, vehicles.branchId))
    .leftJoin(profiles, eq(profiles.id, vehicles.primaryDriverId))
    .where(and(...vehicleConds))
    .orderBy(asc(branches.name), asc(vehicles.plateNumber));

  if (vehicleRows.length === 0) {
    return {
      rows: [],
      summary: {
        from: dayKey(startDate),
        to: dayKey(toDate),
        days: 0,
        vehicles: 0,
        rowCount: 0,
        totalKm: 0,
        totalCost: 0,
        totalLiters: 0,
        loggedDays: 0,
        partialDays: 0,
        notUsedDays: 0,
        mismatchDays: 0,
        unloggedKm: 0,
      },
    };
  }

  const vehicleIds = vehicleRows.map((v) => v.id);

  /* ---------------- logs inside the range ---------------- */
  const logRows = await db
    .select({
      vehicleId: mileageLogs.vehicleId,
      createdAt: mileageLogs.createdAt,
      id: mileageLogs.id,
      entryType: mileageLogs.entryType,
      odometerValue: mileageLogs.odometerValue,
      isTemporaryDriver: mileageLogs.isTemporaryDriver,
      status: mileageLogs.status,
      driverName: profiles.fullName,
      liters: sql<number | null>`${refuelLogs.liters}::float`,
      cost: sql<number | null>`${refuelLogs.totalCost}::float`,
    })
    .from(mileageLogs)
    .innerJoin(profiles, eq(profiles.id, mileageLogs.driverId))
    .leftJoin(refuelLogs, eq(refuelLogs.mileageLogId, mileageLogs.id))
    .where(
      and(
        inArray(mileageLogs.vehicleId, vehicleIds),
        gte(mileageLogs.createdAt, startDate),
        lte(mileageLogs.createdAt, toDate)
      )
    )
    .orderBy(asc(mileageLogs.vehicleId), asc(mileageLogs.createdAt));

  /* ---------------- baseline: last reading before the range ---------------- */
  const baselineWindow = addDays(startDate, -120);
  // Highest reading wins, not the latest by clock: a refuel logged after the
  // evening entry can carry a larger odometer, and odometers only climb.
  const baselineRows = await db
    .select({
      vehicleId: mileageLogs.vehicleId,
      odometerValue: mileageLogs.odometerValue,
      createdAt: mileageLogs.createdAt,
    })
    .from(mileageLogs)
    .where(
      and(
        inArray(mileageLogs.vehicleId, vehicleIds),
        gte(mileageLogs.createdAt, baselineWindow),
        lt(mileageLogs.createdAt, startDate)
      )
    )
    .orderBy(asc(mileageLogs.vehicleId), desc(mileageLogs.odometerValue));

  const baseline = new Map<string, { odo: number; at: Date }>();
  for (const b of baselineRows) {
    if (!baseline.has(b.vehicleId)) {
      baseline.set(b.vehicleId, { odo: b.odometerValue, at: b.createdAt });
    }
  }

  /* ---------------- group logs by vehicle + day ---------------- */
  type DayBucket = {
    logs: typeof logRows;
  };
  const byVehicleDay = new Map<string, DayBucket>();
  for (const l of logRows) {
    const key = `${l.vehicleId}|${dayKey(l.createdAt)}`;
    const bucket = byVehicleDay.get(key) ?? { logs: [] };
    bucket.logs.push(l);
    byVehicleDay.set(key, bucket);
  }

  /* ---------------- build the day grid ---------------- */
  const dayList: string[] = [];
  for (
    let d = new Date(`${dayKey(startDate)}T00:00:00.000Z`);
    d.getTime() <= toDate.getTime();
    d = addDays(d, 1)
  ) {
    dayList.push(dayKey(d));
  }

  const rows: VehicleDailyRow[] = [];

  for (const v of vehicleRows) {
    let lastKnown = baseline.get(v.id) ?? null;
    // indices (into `rows`) of consecutive unreported days awaiting a follow-up
    let pendingIdle: number[] = [];

    for (const day of dayList) {
      const bucket = byVehicleDay.get(`${v.id}|${day}`);

      /* ---------- day with no logs ---------- */
      if (!bucket || bucket.logs.length === 0) {
        rows.push({
          date: day,
          vehicleId: v.id,
          plate: v.plateNumber,
          vehicleLabel: `${v.make} ${v.model}`,
          branchId: v.branchId,
          branchName: v.branchName,
          assignedStaff: v.assignedStaff,
          loggedBy: [],
          morningKm: null,
          eveningKm: null,
          totalKm: null,
          refuelCost: 0,
          refuelLiters: 0,
          refuelCount: 0,
          status: "not_used",
          gapKm: 0,
          mismatch: null,
          severity: "info",
          temporaryUse: false,
          logIds: [],
          reviewStatus: null,
        });
        pendingIdle.push(rows.length - 1);
        continue;
      }

      /* ---------- day with logs ---------- */
      const logs = bucket.logs;
      const first = logs[0];
      const last = logs[logs.length - 1];

      const morningLog = logs.find((l) => l.entryType === "morning");
      const eveningLog = [...logs].reverse().find((l) => l.entryType === "evening");

      const morningKm = (morningLog ?? first).odometerValue;
      const eveningKm = (eveningLog ?? last).odometerValue;
      const totalKm = Math.max(0, eveningKm - morningKm);

      let refuelCost = 0;
      let refuelLiters = 0;
      let refuelCount = 0;
      for (const l of logs) {
        if (l.cost != null) {
          refuelCost += Number(l.cost);
          refuelLiters += Number(l.liters ?? 0);
          refuelCount += 1;
        }
      }

      // Continuity check against the previous known reading.
      let gapKm = 0;
      let mismatch: string | null = null;
      const startOfDay = Math.min(morningKm, first.odometerValue);
      if (lastKnown) {
        const diff = startOfDay - lastKnown.odo;
        if (diff > 0) {
          gapKm = diff;
          mismatch =
            pendingIdle.length > 0
              ? `${fmtInt(diff)} km driven while no log was reported (last reading ${fmtInt(
                  lastKnown.odo
                )} km on ${dayKey(lastKnown.at)})`
              : `Opening reading is ${fmtInt(diff)} km above the previous reading (${fmtInt(
                  lastKnown.odo
                )} km)`;
        } else if (diff < 0) {
          gapKm = diff;
          mismatch = `Odometer went backwards by ${fmtInt(Math.abs(diff))} km versus the previous reading (${fmtInt(
            lastKnown.odo
          )} km)`;
        }
      }

      // Attribute an unreported gap to the idle days that preceded it.
      if (pendingIdle.length > 0 && gapKm > 0) {
        for (const idx of pendingIdle) {
          // gapKm stays 0 on idle rows: the distance is counted once, on the
          // logged day where the discrepancy is actually measured.
          rows[idx].severity = "alert";
          rows[idx].mismatch = `Vehicle appears to have moved — ${fmtInt(
            gapKm
          )} km unaccounted for between ${dayKey(lastKnown!.at)} and the next log on ${day}`;
        }
      }
      pendingIdle = [];

      const hasMorning = !!morningLog;
      const hasEvening = !!eveningLog;

      rows.push({
        date: day,
        vehicleId: v.id,
        plate: v.plateNumber,
        vehicleLabel: `${v.make} ${v.model}`,
        branchId: v.branchId,
        branchName: v.branchName,
        assignedStaff: v.assignedStaff,
        loggedBy: [...new Set(logs.map((l) => l.driverName))],
        morningKm,
        eveningKm,
        totalKm,
        refuelCost: Math.round(refuelCost * 100) / 100,
        refuelLiters: Math.round(refuelLiters * 100) / 100,
        refuelCount,
        status: hasMorning && hasEvening ? "logged" : "partial",
        gapKm,
        mismatch,
        severity: gapKm !== 0 || !hasMorning || !hasEvening ? "alert" : "ok",
        temporaryUse: logs.some((l) => l.isTemporaryDriver),
        logIds: logs.map((l) => l.id),
        // surface the worst state so a manager knows what still needs action
        reviewStatus: logs.some((l) => l.status === "flagged")
          ? "flagged"
          : logs.some((l) => l.status === "pending")
            ? "pending"
            : "approved",
      });

      // Odometers only ever climb, so the day's high-water mark is the correct
      // baseline — a refuel logged after the evening reading must not create a
      // phantom gap on the following day.
      const dayMaxOdo = logs.reduce((m, l) => Math.max(m, l.odometerValue), eveningKm);
      lastKnown = { odo: dayMaxOdo, at: last.createdAt };
    }

    // Trailing idle days with no follow-up reading yet.
    for (const idx of pendingIdle) {
      rows[idx].mismatch = lastKnown
        ? `No log reported — awaiting the next reading to confirm (last recorded ${fmtInt(
            lastKnown.odo
          )} km)`
        : "No mileage ever reported for this vehicle";
    }
  }

  const visible = f.issuesOnly ? rows.filter((r) => r.severity === "alert") : rows;

  // Totals always describe the whole selected range so the KPI cards stay
  // meaningful; only `rowCount` reflects the narrowed table.
  const summary = {
    from: dayKey(startDate),
    to: dayKey(toDate),
    days: dayList.length,
    vehicles: vehicleRows.length,
    rowCount: visible.length,
    totalKm: rows.reduce((s, r) => s + (r.totalKm ?? 0), 0),
    totalCost: Math.round(rows.reduce((s, r) => s + r.refuelCost, 0) * 100) / 100,
    totalLiters: Math.round(rows.reduce((s, r) => s + r.refuelLiters, 0) * 100) / 100,
    loggedDays: rows.filter((r) => r.status === "logged").length,
    partialDays: rows.filter((r) => r.status === "partial").length,
    notUsedDays: rows.filter((r) => r.status === "not_used").length,
    mismatchDays: rows.filter((r) => r.severity === "alert").length,
    unloggedKm: rows.reduce((s, r) => s + (r.gapKm > 0 ? r.gapKm : 0), 0),
  };

  return { rows: visible, summary };
}

/** plain integer grouping for report notes (locale-independent) */
function fmtInt(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/* ------------------------------------------------------------------ */
/* Security portal (super admin)                                       */
/* ------------------------------------------------------------------ */

export type SecurityAccount = {
  id: string;
  fullName: string;
  email: string;
  role: "super_admin" | "branch_manager" | "driver";
  branchName: string | null;
  avatarColor: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  passwordSetAt: string;
  passwordSetByName: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
  neverLoggedIn: boolean;
};

export type SecurityOverview = {
  accounts: SecurityAccount[];
  stats: {
    total: number;
    active: number;
    deactivated: number;
    locked: number;
    neverLoggedIn: number;
    stalePasswords: number;
    admins: number;
  };
  events: AuditRow[];
};

const SECURITY_ACTIONS = [
  "user.created",
  "user.updated",
  "user.deleted",
  "user.activated",
  "user.deactivated",
  "user.unlocked",
  "user.password_reset",
  "user.password_viewed",
  "account.password_changed",
];

export async function getSecurityOverview(): Promise<SecurityOverview> {
  const setter = alias(profiles, "password_setter");

  const rows = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      email: profiles.email,
      role: profiles.role,
      avatarColor: profiles.avatarColor,
      isActive: profiles.isActive,
      lastLoginAt: profiles.lastLoginAt,
      passwordSetAt: profiles.passwordSetAt,
      failedAttempts: profiles.failedAttempts,
      lockedUntil: profiles.lockedUntil,
      branchName: branches.name,
      passwordSetByName: setter.fullName,
    })
    .from(profiles)
    .leftJoin(branches, eq(branches.id, profiles.branchId))
    .leftJoin(setter, eq(setter.id, profiles.passwordSetBy))
    .orderBy(asc(profiles.role), asc(profiles.fullName));

  const now = Date.now();
  const NINETY_DAYS = 90 * 86400000;

  const accounts: SecurityAccount[] = rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    email: r.email,
    role: r.role,
    branchName: r.branchName,
    avatarColor: r.avatarColor,
    isActive: r.isActive,
    lastLoginAt: r.lastLoginAt ? r.lastLoginAt.toISOString() : null,
    passwordSetAt: r.passwordSetAt.toISOString(),
    passwordSetByName: r.passwordSetByName,
    failedAttempts: r.failedAttempts,
    lockedUntil: r.lockedUntil ? r.lockedUntil.toISOString() : null,
    neverLoggedIn: !r.lastLoginAt,
  }));

  const eventRows = await db
    .select({
      audit: auditLogs,
      actorName: profiles.fullName,
      branchName: branches.name,
    })
    .from(auditLogs)
    .leftJoin(profiles, eq(profiles.id, auditLogs.actorId))
    .leftJoin(branches, eq(branches.id, auditLogs.branchId))
    .where(inArray(auditLogs.action, SECURITY_ACTIONS))
    .orderBy(desc(auditLogs.createdAt))
    .limit(60);

  return {
    accounts,
    stats: {
      total: accounts.length,
      active: accounts.filter((a) => a.isActive).length,
      deactivated: accounts.filter((a) => !a.isActive).length,
      locked: accounts.filter((a) => a.lockedUntil && new Date(a.lockedUntil).getTime() > now)
        .length,
      neverLoggedIn: accounts.filter((a) => a.neverLoggedIn).length,
      stalePasswords: accounts.filter(
        (a) => now - new Date(a.passwordSetAt).getTime() > NINETY_DAYS
      ).length,
      admins: accounts.filter((a) => a.role === "super_admin" && a.isActive).length,
    },
    events: eventRows.map((r) => ({
      ...r.audit,
      actorName: r.actorName,
      branchName: r.branchName,
    })),
  };
}

export async function listDriversForBranch(branchId: string) {
  return db
    .select()
    .from(profiles)
    .where(and(eq(profiles.branchId, branchId), eq(profiles.role, "driver")))
    .orderBy(asc(profiles.fullName));
}

export type { Profile, Vehicle, Branch, RefuelLog };
