-- FleetPulse production schema for Supabase Postgres.
--
-- Run this file once in Supabase Dashboard > SQL Editor. The application uses
-- its own server-side session and password authentication, so profiles.id is
-- not linked to auth.users. Keep DATABASE_URL server-only in Vercel.

create extension if not exists "pgcrypto";

create type user_role as enum ('super_admin', 'branch_manager', 'driver');
create type vehicle_status as enum ('active', 'maintenance', 'retired');
create type entry_type as enum ('morning', 'evening', 'refuel');
create type log_status as enum ('pending', 'approved', 'flagged');
create type trip_purpose as enum (
  'guest_driver', 'emergency', 'maintenance_transport',
  'branch_support', 'official_errand'
);

create table branches (
  id uuid primary key default gen_random_uuid(),
  name varchar(80) not null unique,
  city varchar(80) not null,
  code varchar(8) not null unique,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  email varchar(160) not null unique,
  full_name varchar(120) not null,
  role user_role not null default 'driver',
  branch_id uuid references branches(id) on delete set null,
  phone varchar(32),
  license_number varchar(40),
  avatar_color varchar(16) default '#245bc1',
  password_hash text not null,
  password_plain varchar(64),
  password_set_at timestamptz not null default now(),
  password_set_by uuid,
  is_active boolean not null default true,
  last_login_at timestamptz,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  plate_number varchar(16) not null unique,
  make varchar(60) not null,
  model varchar(60) not null,
  year integer not null,
  fuel_type varchar(24) not null default 'diesel',
  branch_id uuid not null references branches(id) on delete restrict,
  primary_driver_id uuid references profiles(id) on delete set null,
  status vehicle_status not null default 'active',
  current_odometer integer not null default 0,
  created_at timestamptz not null default now()
);

create table mileage_logs (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references profiles(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  entry_type entry_type not null,
  odometer_value integer not null,
  distance_km integer not null default 0,
  is_temporary_driver boolean not null default false,
  trip_purpose trip_purpose,
  status log_status not null default 'pending',
  photo_url text,
  location_lat numeric(10,7),
  location_lng numeric(10,7),
  note text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint temp_driver_requires_purpose
    check (is_temporary_driver = false or trip_purpose is not null)
);

create table refuel_logs (
  id uuid primary key default gen_random_uuid(),
  mileage_log_id uuid not null unique references mileage_logs(id) on delete cascade,
  liters numeric(8,2) not null check (liters > 0),
  total_cost numeric(10,2) not null check (total_cost > 0),
  price_per_liter numeric(6,3),
  station_name varchar(120),
  receipt_url text,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  action varchar(60) not null,
  entity_type varchar(40) not null,
  entity_id uuid,
  details text,
  branch_id uuid references branches(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_logs_vehicle_created on mileage_logs (vehicle_id, created_at desc);
create index idx_logs_branch_created on mileage_logs (branch_id, created_at desc);
create index idx_logs_driver_created on mileage_logs (driver_id, created_at desc);
create index idx_logs_status on mileage_logs (status) where status <> 'approved';

-- The app connects through the server-only Supabase Postgres connection and
-- enforces authorization in src/lib/auth.ts and the API routes. RLS is enabled
-- so accidental browser access is denied by default; no public policies exist.
alter table branches enable row level security;
alter table profiles enable row level security;
alter table vehicles enable row level security;
alter table mileage_logs enable row level security;
alter table refuel_logs enable row level security;
alter table audit_logs enable row level security;
