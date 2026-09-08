/**
 * FleetPulse — deterministic database seed.
 * Run with: npx tsx src/db/seed.ts
 */
import { db } from "./index";
import {
  auditLogs,
  branches,
  mileageLogs,
  profiles,
  refuelLogs,
  vehicles,
} from "./schema";
import { sql } from "drizzle-orm";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/* ------------------------------------------------------------------ */
/* Deterministic PRNG                                                  */
/* ------------------------------------------------------------------ */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260214);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const rint = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min;
const chance = (p: number) => rand() < p;

/* ------------------------------------------------------------------ */
/* Static data                                                         */
/* ------------------------------------------------------------------ */

const BRANCHES = [
  { name: "Milan", code: "MIL" },
  { name: "Rome", code: "ROM" },
  { name: "Turin", code: "TOR" },
  { name: "Naples", code: "NAP" },
  { name: "Bologna", code: "BOL" },
  { name: "Bari", code: "BAR" },
  { name: "Padua", code: "PAD" },
  { name: "Palermo", code: "PAL" },
] as const;

const MANAGERS: Record<string, string> = {
  MIL: "Giulia Ferraro",
  ROM: "Alessandro Greco",
  TOR: "Federica Marino",
  NAP: "Salvatore Esposito",
  BOL: "Chiara Rizzo",
  BAR: "Michele De Santis",
  PAD: "Irene Colombo",
  PAL: "Davide Vitale",
};

const DRIVER_NAMES = [
  "Marco Rossi", "Luca Bianchi", "Andrea Conti", "Francesco Gallo",
  "Stefano Moretti", "Paolo Ricci", "Giovanni Barbieri", "Roberto Fontana",
  "Elena Mariani", "Sara Lombardi", "Valentina Serra", "Marta Bruno",
  "Alessia Ferri", "Giorgia De Luca", "Tommaso Caruso", "Matteo Santoro",
  "Nicola Rinaldi", "Simone Villa", "Daniele Longo", "Fabio Martinelli",
  "Claudio Gentile", "Massimo Pellegrini", "Vincenzo Leone", "Antonio Vitiello",
  "Pietro Amato", "Raffaele Palumbo", "Giuseppe Sorrentino", "Emanuele Basile",
  "Cristian Farina", "Lorenzo Monti", "Gabriele Costa", "Filippo Benedetti",
  "Silvia Negri", "Anna Bellini", "Laura Giuliani", "Federico Testa",
  "Riccardo Grassi", "Alberto Ferrara", "Dario Lombardo", "Sergio Marchetti",
  "Elisa Caputo", "Monica Parisi", "Tiziana Riva", "Walter Orlando",
];

const VEHICLE_MODELS: Array<{ make: string; model: string; fuel: string }> = [
  { make: "Fiat", model: "Ducato", fuel: "diesel" },
  { make: "Fiat", model: "Panda", fuel: "petrol" },
  { make: "Fiat", model: "Tipo", fuel: "diesel" },
  { make: "Fiat", model: "Doblò", fuel: "diesel" },
  { make: "Renault", model: "Clio", fuel: "petrol" },
  { make: "Toyota", model: "Yaris", fuel: "hybrid" },
  { make: "Volkswagen", model: "Golf", fuel: "diesel" },
  { make: "Peugeot", model: "208", fuel: "petrol" },
  { make: "Ford", model: "Transit", fuel: "diesel" },
  { make: "Opel", model: "Corsa", fuel: "petrol" },
  { make: "Jeep", model: "Renegade", fuel: "diesel" },
  { make: "Alfa Romeo", model: "Giulietta", fuel: "diesel" },
  { make: "Dacia", model: "Duster", fuel: "petrol" },
  { make: "Citroën", model: "C3", fuel: "petrol" },
];

const STATIONS = ["Eni", "IP", "Esso", "Q8", "Tamoil", "Agip", "TotalErg"];

const PURPOSES = [
  "guest_driver",
  "emergency",
  "maintenance_transport",
  "branch_support",
  "official_errand",
] as const;

const AVATAR_COLORS = [
  "#245bc1", "#08dc7d", "#46286E", "#00b3d7", "#c2741a", "#21264e",
];

/* Deterministic, readable seed passwords (same shape as generatePassword). */
const PW_A = ["Alpha", "Bravo", "Cobalt", "Delta", "Ember", "Falcon", "Granite", "Harbor", "Indigo", "Juniper", "Kestrel", "Lumen", "Marble", "Nimbus", "Onyx", "Pilot", "Quartz", "Ridge", "Summit", "Tundra", "Umber", "Vector", "Willow", "Zenith"];
const PW_B = ["Anchor", "Beacon", "Canyon", "Drift", "Echo", "Forge", "Glide", "Haven", "Ivory", "Jetty", "Kernel", "Lantern", "Meadow", "North", "Orbit", "Prairie", "Quiver", "River", "Stone", "Trail", "Union", "Valley", "Wander", "Yonder"];
const PW_C = ["Fox", "Lynx", "Hawk", "Otter", "Ibis", "Wolf", "Crane", "Bison", "Heron", "Puma", "Raven", "Seal", "Tiger", "Viper", "Whale", "Zebra"];

function seedPassword() {
  return `${pick(PW_A)}-${pick(PW_B)}-${pick(PW_C)}-${rint(100, 999)}`;
}

function plate() {
  const L = () => String.fromCharCode(65 + rint(0, 25));
  return `${L()}${L()} ${rint(100, 999)}${L()}${L()}`;
}
function emailFor(name: string) {
  return (
    name.toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".") +
    "@meridian-group.it"
  );
}

/* ------------------------------------------------------------------ */
/* SVG snapshot generators (odometer + receipt)                        */
/* ------------------------------------------------------------------ */

function odometerSvg(odo: number, plateNumber: string, day: string) {
  const digits = String(odo).padStart(7, "0").split("");
  const cells = digits
    .map((d, i) => {
      const x = 40 + i * 78;
      const isLast = i === digits.length - 1;
      return `<rect x="${x}" y="150" width="70" height="96" rx="10" fill="${
        isLast ? "#ffc8b2" : "#2b3160"
      }" stroke="#3d4478" stroke-width="2"/>
      <text x="${x + 35}" y="212" font-family="monospace" font-size="52" font-weight="700" text-anchor="middle" fill="${
        isLast ? "#21264e" : "#fff7f2"
      }">${d}</text>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
    <rect width="640" height="400" rx="24" fill="#21264e"/>
    <circle cx="320" cy="205" r="150" fill="none" stroke="#3d4478" stroke-width="3" stroke-dasharray="6 10"/>
    <text x="40" y="72" font-family="monospace" font-size="26" fill="#08dc7d" letter-spacing="4">ODOMETER</text>
    <text x="600" y="72" font-family="monospace" font-size="22" fill="#8f96c9" text-anchor="end">${plateNumber}</text>
    ${cells}
    <text x="40" y="300" font-family="monospace" font-size="20" fill="#8f96c9">KM · TOTAL</text>
    <text x="600" y="300" font-family="monospace" font-size="20" fill="#8f96c9" text-anchor="end" opacity="0.7">KILOMETERS</text>
    <text x="320" y="360" font-family="monospace" font-size="17" fill="#5b62a0" text-anchor="middle">${day}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function receiptSvg(
  station: string,
  liters: number,
  cost: number,
  ppl: number,
  plateNumber: string,
  day: string
) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640">
    <rect width="480" height="640" fill="#fff7f2"/>
    <rect x="0" y="0" width="480" height="640" fill="none"/>
    <text x="240" y="70" font-family="monospace" font-size="34" font-weight="700" text-anchor="middle" fill="#21264e">${station.toUpperCase()}</text>
    <text x="240" y="104" font-family="monospace" font-size="16" text-anchor="middle" fill="#8a7f78">FUEL STATION · ITALIA</text>
    <line x1="40" y1="130" x2="440" y2="130" stroke="#21264e" stroke-width="2" stroke-dasharray="4 6"/>
    <text x="40" y="172" font-family="monospace" font-size="20" fill="#21264e">DATA</text>
    <text x="440" y="172" font-family="monospace" font-size="20" text-anchor="end" fill="#21264e">${day}</text>
    <text x="40" y="216" font-family="monospace" font-size="20" fill="#21264e">TARGA</text>
    <text x="440" y="216" font-family="monospace" font-size="20" text-anchor="end" fill="#21264e">${plateNumber}</text>
    <text x="40" y="260" font-family="monospace" font-size="20" fill="#21264e">PRODOTTO</text>
    <text x="440" y="260" font-family="monospace" font-size="20" text-anchor="end" fill="#21264e">GASOLIO AUTO</text>
    <line x1="40" y1="288" x2="440" y2="288" stroke="#21264e" stroke-width="2" stroke-dasharray="4 6"/>
    <text x="40" y="330" font-family="monospace" font-size="22" fill="#21264e">LITRI</text>
    <text x="440" y="330" font-family="monospace" font-size="22" text-anchor="end" fill="#21264e">${liters.toFixed(2)}</text>
    <text x="40" y="372" font-family="monospace" font-size="22" fill="#21264e">€/L</text>
    <text x="440" y="372" font-family="monospace" font-size="22" text-anchor="end" fill="#21264e">${ppl.toFixed(3)}</text>
    <rect x="40" y="410" width="400" height="72" rx="12" fill="#21264e"/>
    <text x="64" y="456" font-family="monospace" font-size="26" fill="#fff7f2">TOTALE</text>
    <text x="416" y="456" font-family="monospace" font-size="26" font-weight="700" text-anchor="end" fill="#08dc7d">€ ${cost.toFixed(2)}</text>
    <text x="240" y="540" font-family="monospace" font-size="15" text-anchor="middle" fill="#8a7f78">IVA INCLUSA 22% · P.IVA 04401920615</text>
    <text x="240" y="566" font-family="monospace" font-size="15" text-anchor="middle" fill="#8a7f78">GRAZIE E ARRIVEDERCI</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  console.log("Truncating existing data…");
  await db.execute(sql`TRUNCATE TABLE refuel_logs, mileage_logs, audit_logs, vehicles, profiles, branches RESTART IDENTITY CASCADE`);

  console.log("Seeding branches…");
  const branchRows = await db
    .insert(branches)
    .values(
      BRANCHES.map((b) => ({ name: b.name, city: b.name, code: b.code }))
    )
    .returning();
  const branchByCode = new Map(branchRows.map((b) => [b.code, b]));

  console.log("Seeding profiles…");
  const branchDriverCounts: Record<string, number> = {
    MIL: 8, ROM: 8, TOR: 6, NAP: 6, BOL: 5, BAR: 4, PAD: 4, PAL: 3,
  };

  type ProfileInsert = typeof profiles.$inferInsert;
  const supabase = createSupabaseAdminClient();
  const seedPasswords = new Map<string, string>();

  /** Create each profile with a matching Supabase Auth identity. */
  const withCreds = async <T extends ProfileInsert>(p: T): Promise<ProfileInsert> => {
    const pw = seedPassword();
    const { data, error } = await supabase.auth.admin.createUser({
      email: p.email,
      password: pw,
      email_confirm: true,
      user_metadata: { full_name: p.fullName },
    });
    if (error || !data.user) throw new Error(error?.message ?? `Could not create ${p.email}`);
    seedPasswords.set(p.email, pw);
    return { ...p, id: data.user.id, passwordPlain: null, passwordHash: null };
  };

  const profileInserts: ProfileInsert[] = [
    await withCreds({
      fullName: "Elena Marchetti",
      email: "elena.marchetti@meridian-group.it",
      role: "super_admin",
      branchId: null,
      phone: "+39 02 0000 001",
      avatarColor: "#46286E",
    }),
  ];

  let nameIdx = 0;
  const driverByBranch = new Map<string, string[]>();

  for (const b of BRANCHES) {
    profileInserts.push(
      await withCreds({
        fullName: MANAGERS[b.code],
        email: emailFor(MANAGERS[b.code]),
        role: "branch_manager",
        branchId: branchByCode.get(b.code)!.id,
        phone: `+39 0${rint(2, 9)} ${rint(100, 999)} ${rint(1000, 9999)}`,
        avatarColor: pick(AVATAR_COLORS),
      })
    );
    const names: string[] = [];
    for (let i = 0; i < branchDriverCounts[b.code]; i++) {
      const fullName = DRIVER_NAMES[nameIdx++];
      names.push(fullName);
      profileInserts.push(
        await withCreds({
          fullName,
          email: emailFor(fullName),
          role: "driver",
          branchId: branchByCode.get(b.code)!.id,
          phone: `+39 3${rint(10, 99)} ${rint(100, 999)} ${rint(1000, 9999)}`,
          licenseNumber: `U1${rint(10000000, 99999999)}X`,
          avatarColor: pick(AVATAR_COLORS),
        })
      );
    }
    driverByBranch.set(b.code, names);
  }

  const profileRows = await db.insert(profiles).values(profileInserts).returning();
  const driverRows = profileRows.filter((p) => p.role === "driver");
  const superAdmin = profileRows.find((p) => p.role === "super_admin")!;
  const managerByBranch = new Map(
    profileRows
      .filter((p) => p.role === "branch_manager")
      .map((p) => [p.branchId!, p])
  );
  const driversByBranchId = new Map<string, typeof driverRows>();
  for (const d of driverRows) {
    const arr = driversByBranchId.get(d.branchId!) ?? [];
    arr.push(d);
    driversByBranchId.set(d.branchId!, arr);
  }

  console.log("Seeding vehicles…");
  const extraPool: Record<string, number> = { MIL: 1, ROM: 1, TOR: 1, NAP: 1 };
  type VehicleInsert = typeof vehicles.$inferInsert;
  const vehicleInserts: VehicleInsert[] = [];
  const plateSet = new Set<string>();

  for (const b of BRANCHES) {
    const branchId = branchByCode.get(b.code)!.id;
    const drivers = driversByBranchId.get(branchId)!;
    const total = drivers.length + (extraPool[b.code] ?? 0);
    for (let i = 0; i < total; i++) {
      const model = pick(VEHICLE_MODELS);
      let p = plate();
      while (plateSet.has(p)) p = plate();
      plateSet.add(p);
      const assigned = drivers[i] ?? null; // last ones = pool vehicles
      vehicleInserts.push({
        plateNumber: p,
        make: model.make,
        model: model.model,
        year: rint(2019, 2025),
        fuelType: model.fuel,
        branchId,
        primaryDriverId: assigned ? assigned.id : null,
        status: chance(0.94) ? "active" : "maintenance",
        currentOdometer: rint(18000, 115000),
      });
    }
  }
  const vehicleRows = await db.insert(vehicles).values(vehicleInserts).returning();

  console.log("Seeding mileage + refuel history (this takes a moment)…");
  const DAYS = 80;
  const now = Date.now();

  type LogInsert = typeof mileageLogs.$inferInsert;
  type RefuelInsert = typeof refuelLogs.$inferInsert;
  type AuditInsert = typeof auditLogs.$inferInsert;

  const logBatch: LogInsert[] = [];
  const refuelBatch: RefuelInsert[] = [];
  const auditBatch: AuditInsert[] = [];

  // Keep insertion-time linking for refuels via index alignment.
  const refuelIdx: number[] = [];

  const allDrivers = driverRows;

  for (const v of vehicleRows) {
    let odo = v.currentOdometer - rint(2200, 4200); // work backwards
    if (odo < 5000) odo = 9000;
    let sinceRefuel = 0;

    for (let day = DAYS; day >= 1; day--) {
      const date = new Date(now - day * 86400000);
      const dow = date.getDay();
      const driven = dow === 0 ? chance(0.25) : dow === 6 ? chance(0.45) : chance(0.88);
      if (!driven || v.status === "retired") continue;

      const branchDrivers = driversByBranchId.get(v.branchId)!;
      const primary = v.primaryDriverId
        ? allDrivers.find((d) => d.id === v.primaryDriverId) ?? null
        : null;

      const isTemp = chance(primary ? 0.12 : 0.35);
      const tempDriverPool =
        branchDrivers.filter((d) => d.id !== v.primaryDriverId).length > 0
          ? branchDrivers.filter((d) => d.id !== v.primaryDriverId)
          : allDrivers.filter((d) => d.id !== v.primaryDriverId);
      const driver =
        isTemp && tempDriverPool.length > 0
          ? pick(tempDriverPool)
          : primary ?? pick(tempDriverPool);

      const kmToday = rint(24, 148);
      const morningOdo = odo;
      const eveningOdo = odo + kmToday;
      const dayLabel = date.toISOString().slice(0, 10);

      const old = day > 3;
      const statusFor = (): LogInsert["status"] => {
        if (old) return chance(0.93) ? "approved" : "flagged";
        return chance(0.72) ? "pending" : chance(0.9) ? "approved" : "flagged";
      };
      const reviewer = managerByBranch.get(v.branchId);

      const purpose = isTemp ? pick(PURPOSES) : null;
      const mkTime = (h: number, m: number) =>
        new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);

      /**
       * Reviews are issued by the local office (branch) manager, or
       * occasionally escalated to the fleet manager (super admin).
       */
      const mkReview = (s: LogInsert["status"], at: Date) => {
        if (s === "pending") return { reviewedBy: null, reviewedAt: null };
        const by = chance(0.15) ? superAdmin : (reviewer ?? superAdmin);
        return {
          reviewedBy: by.id,
          reviewedAt: new Date(at.getTime() + 3600000 * rint(2, 30)),
        };
      };

      const morningStatus = statusFor();
      const morningAt = mkTime(rint(7, 9), rint(0, 59));
      logBatch.push({
        driverId: driver.id,
        vehicleId: v.id,
        branchId: v.branchId,
        entryType: "morning",
        odometerValue: morningOdo,
        distanceKm: 0,
        isTemporaryDriver: isTemp,
        tripPurpose: purpose,
        status: morningStatus,
        photoUrl: chance(0.85)
          ? odometerSvg(morningOdo, v.plateNumber, dayLabel)
          : null,
        locationLat: (41 + rand() * 5.5).toFixed(7),
        locationLng: (8 + rand() * 10).toFixed(7),
        ...mkReview(morningStatus, morningAt),
        createdAt: morningAt,
      });

      const eveningStatus = statusFor();
      const eveningAt = mkTime(rint(17, 19), rint(0, 59));
      logBatch.push({
        driverId: driver.id,
        vehicleId: v.id,
        branchId: v.branchId,
        entryType: "evening",
        odometerValue: eveningOdo,
        distanceKm: kmToday,
        isTemporaryDriver: isTemp,
        tripPurpose: purpose,
        status: eveningStatus,
        photoUrl: chance(0.85)
          ? odometerSvg(eveningOdo, v.plateNumber, dayLabel)
          : null,
        locationLat: (41 + rand() * 5.5).toFixed(7),
        locationLng: (8 + rand() * 10).toFixed(7),
        ...mkReview(eveningStatus, eveningAt),
        createdAt: eveningAt,
      });

      sinceRefuel += kmToday;
      const tankRefuel = sinceRefuel > rint(420, 700);
      if (tankRefuel) {
        const liters = Math.min(
          62,
          Math.max(18, sinceRefuel * (0.055 + rand() * 0.02))
        );
        const ppl = 1.72 + rand() * 0.24;
        const cost = liters * ppl;
        const refuelOdo = eveningOdo + rint(3, 18);
        const idx = logBatch.length;
        const refuelStatus = statusFor();
        const refuelAt = mkTime(rint(12, 18), rint(0, 59));
        logBatch.push({
          driverId: driver.id,
          vehicleId: v.id,
          branchId: v.branchId,
          entryType: "refuel",
          odometerValue: refuelOdo,
          distanceKm: refuelOdo - eveningOdo,
          isTemporaryDriver: isTemp,
          tripPurpose: purpose,
          status: refuelStatus,
          photoUrl: chance(0.75)
            ? odometerSvg(refuelOdo, v.plateNumber, dayLabel)
            : null,
          ...mkReview(refuelStatus, refuelAt),
          createdAt: refuelAt,
        });
        refuelIdx.push(idx);
        refuelBatch.push({
          mileageLogId: "", // fill in later
          liters: liters.toFixed(2),
          totalCost: cost.toFixed(2),
          pricePerLiter: ppl.toFixed(3),
          stationName: pick(STATIONS),
          receiptUrl: receiptSvg(
            pick(STATIONS),
            liters,
            cost,
            ppl,
            v.plateNumber,
            dayLabel
          ),
          createdAt: mkTime(rint(12, 18), rint(0, 59)),
        });
        odo = refuelOdo;
        sinceRefuel = 0;
      } else {
        odo = eveningOdo;
      }
    }
  }

  // Insert mileage logs in chunks, capturing ids for refuel linking.
  const CHUNK = 500;
  const insertedIds: string[] = [];
  for (let i = 0; i < logBatch.length; i += CHUNK) {
    const rows = await db
      .insert(mileageLogs)
      .values(logBatch.slice(i, i + CHUNK))
      .returning({ id: mileageLogs.id, status: mileageLogs.status });
    insertedIds.push(...rows.map((r) => r.id));

    // review metadata for approved/flagged
    rows.forEach((r, j) => {
      const src = logBatch[i + j];
      if (r.status !== "pending") {
        const mgr = managerByBranch.get(src.branchId);
        if (mgr) {
          auditBatch.push({
            actorId: mgr.id,
            action: r.status === "approved" ? "log.approved" : "log.flagged",
            entityType: "mileage_log",
            entityId: r.id,
            branchId: src.branchId,
            details:
              r.status === "approved"
                ? `Approved ${src.entryType} entry · ${src.odometerValue.toLocaleString()} km`
                : `Flagged ${src.entryType} entry — odometer mismatch review (${src.odometerValue.toLocaleString()} km)`,
            createdAt: new Date(
              (src.createdAt as Date).getTime() + 3600000 * rint(2, 30)
            ),
          });
        }
      }
    });
  }

  // Link refuels to their mileage log ids
  const refuelInserts = refuelBatch.map((r, i) => ({
    ...r,
    mileageLogId: insertedIds[refuelIdx[i]],
  }));
  for (let i = 0; i < refuelInserts.length; i += CHUNK) {
    await db.insert(refuelLogs).values(refuelInserts.slice(i, i + CHUNK));
  }

  // Update vehicle odometers to the latest log value
  for (const v of vehicleRows) {
    const latest = logBatch
      .filter((l) => l.vehicleId === v.id)
      .reduce((m, l) => Math.max(m, l.odometerValue), v.currentOdometer);
    await db.execute(
      sql`UPDATE vehicles SET current_odometer = ${latest} WHERE id = ${v.id}`
    );
  }

  // System audit filler
  const admin = superAdmin;
  for (const v of vehicleRows.slice(0, 12)) {
    auditBatch.push({
      actorId: admin.id,
      action: "vehicle.registered",
      entityType: "vehicle",
      entityId: v.id,
      branchId: v.branchId,
      details: `Registered ${v.make} ${v.model} · ${v.plateNumber}`,
      createdAt: new Date(now - rint(80, 160) * 86400000),
    });
  }
  auditBatch.push({
    actorId: admin.id,
    action: "policy.updated",
    entityType: "system",
    entityId: null,
    branchId: null,
    details: "Updated temporary-driver policy: trip purpose now mandatory",
    createdAt: new Date(now - 6 * 86400000),
  });

  auditBatch.sort(
    (a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime()
  );
  for (let i = 0; i < auditBatch.length; i += CHUNK) {
    await db.insert(auditLogs).values(auditBatch.slice(i, i + CHUNK));
  }

  console.log(
    `Seeded: ${branchRows.length} branches, ${profileRows.length} profiles, ${vehicleRows.length} vehicles, ${insertedIds.length} mileage logs, ${refuelInserts.length} refuels, ${auditBatch.length} audit entries.`
  );

  const sample = [
    profileRows.find((p) => p.role === "super_admin")!,
    profileRows.find((p) => p.role === "branch_manager")!,
    profileRows.find((p) => p.role === "driver")!,
  ];
  console.log("\nSign-in credentials:");
  for (const p of sample) {
    console.log(`  ${p.role.padEnd(15)} ${p.email}  ${seedPasswords.get(p.email) ?? ""}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
