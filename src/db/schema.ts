import { relations } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "branch_manager",
  "driver",
]);

export const vehicleStatusEnum = pgEnum("vehicle_status", [
  "active",
  "maintenance",
  "retired",
]);

export const entryTypeEnum = pgEnum("entry_type", [
  "morning",
  "evening",
  "refuel",
]);

export const logStatusEnum = pgEnum("log_status", [
  "pending",
  "approved",
  "flagged",
]);

export const tripPurposeEnum = pgEnum("trip_purpose", [
  "guest_driver",
  "emergency",
  "maintenance_transport",
  "branch_support",
  "official_errand",
]);

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

export const branches = pgTable("branches", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  city: varchar("city", { length: 80 }).notNull(),
  code: varchar("code", { length: 8 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  fullName: varchar("full_name", { length: 120 }).notNull(),
  role: userRoleEnum("role").notNull().default("driver"),
  branchId: uuid("branch_id").references(() => branches.id, {
    onDelete: "set null",
  }),
  phone: varchar("phone", { length: 32 }),
  vehicleReg: varchar("vehicle_reg", { length: 40 }),
  drivingLicenceNumber: varchar("driving_licence_number", { length: 40 }),
  drivingLicenceExpiry: timestamp("driving_licence_expiry", { withTimezone: true }),
  avatarColor: varchar("avatar_color", { length: 16 }).default("#245bc1"),

  /* ---------------- credentials (super-admin managed) ---------------- */
  /** scrypt digest — `scrypt$N$r$p$salt$hash`, never returned to clients. */
  /** Deprecated: authentication is managed by Supabase Auth. */
  passwordHash: text("password_hash"),
  /**
   * Current password in readable form so the Super Admin can hand it to a
   * driver. Only ever exposed to super_admin through /api/users/:id/password.
   * Rotated on every reset. Drivers cannot change their own password.
   */
  passwordPlain: varchar("password_plain", { length: 64 }),
  passwordSetAt: timestamp("password_set_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  passwordSetBy: uuid("password_set_by"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const vehicles = pgTable("vehicles", {
  id: uuid("id").defaultRandom().primaryKey(),
  plateNumber: varchar("plate_number", { length: 16 }).notNull().unique(),
  make: varchar("make", { length: 60 }).notNull(),
  model: varchar("model", { length: 60 }).notNull(),
  year: integer("year").notNull(),
  fuelType: varchar("fuel_type", { length: 24 }).notNull().default("diesel"),
  branchId: uuid("branch_id")
    .references(() => branches.id, { onDelete: "restrict" })
    .notNull(),
  primaryDriverId: uuid("primary_driver_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  status: vehicleStatusEnum("status").notNull().default("active"),
  currentOdometer: integer("current_odometer").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const mileageLogs = pgTable("mileage_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  driverId: uuid("driver_id")
    .references(() => profiles.id, { onDelete: "cascade" })
    .notNull(),
  vehicleId: uuid("vehicle_id")
    .references(() => vehicles.id, { onDelete: "cascade" })
    .notNull(),
  branchId: uuid("branch_id")
    .references(() => branches.id, { onDelete: "cascade" })
    .notNull(),
  entryType: entryTypeEnum("entry_type").notNull(),
  odometerValue: integer("odometer_value").notNull(),
  /** derived: odometer delta vs the previous log of the same vehicle */
  distanceKm: integer("distance_km").notNull().default(0),
  isTemporaryDriver: boolean("is_temporary_driver").notNull().default(false),
  tripPurpose: tripPurposeEnum("trip_purpose"),
  status: logStatusEnum("status").notNull().default("pending"),
  photoUrl: text("photo_url"),
  locationLat: numeric("location_lat", { precision: 10, scale: 7 }),
  locationLng: numeric("location_lng", { precision: 10, scale: 7 }),
  note: text("note"),
  reviewedBy: uuid("reviewed_by").references(() => profiles.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const refuelLogs = pgTable("refuel_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  mileageLogId: uuid("mileage_log_id")
    .references(() => mileageLogs.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  liters: numeric("liters", { precision: 8, scale: 2 }).notNull(),
  totalCost: numeric("total_cost", { precision: 10, scale: 2 }).notNull(),
  pricePerLiter: numeric("price_per_liter", { precision: 6, scale: 3 }),
  stationName: varchar("station_name", { length: 120 }),
  receiptUrl: text("receipt_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  action: varchar("action", { length: 60 }).notNull(),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: uuid("entity_id"),
  details: text("details"),
  branchId: uuid("branch_id").references(() => branches.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const branchesRelations = relations(branches, ({ many }) => ({
  vehicles: many(vehicles),
  profiles: many(profiles),
  logs: many(mileageLogs),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  branch: one(branches, {
    fields: [profiles.branchId],
    references: [branches.id],
  }),
  assignedVehicles: many(vehicles),
  logs: many(mileageLogs),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  branch: one(branches, {
    fields: [vehicles.branchId],
    references: [branches.id],
  }),
  primaryDriver: one(profiles, {
    fields: [vehicles.primaryDriverId],
    references: [profiles.id],
  }),
  logs: many(mileageLogs),
}));

export const mileageLogsRelations = relations(mileageLogs, ({ one }) => ({
  driver: one(profiles, {
    fields: [mileageLogs.driverId],
    references: [profiles.id],
  }),
  vehicle: one(vehicles, {
    fields: [mileageLogs.vehicleId],
    references: [vehicles.id],
  }),
  branch: one(branches, {
    fields: [mileageLogs.branchId],
    references: [branches.id],
  }),
  refuel: one(refuelLogs, {
    fields: [mileageLogs.id],
    references: [refuelLogs.mileageLogId],
  }),
}));

export const refuelLogsRelations = relations(refuelLogs, ({ one }) => ({
  mileageLog: one(mileageLogs, {
    fields: [refuelLogs.mileageLogId],
    references: [mileageLogs.id],
  }),
}));

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Branch = typeof branches.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type MileageLog = typeof mileageLogs.$inferSelect;
export type RefuelLog = typeof refuelLogs.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
