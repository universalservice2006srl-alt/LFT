-- FleetPulse branch seed data.
-- Safe to run repeatedly in Supabase SQL Editor.

-- The legacy database incorrectly linked branches.id to users.id.
-- Branch IDs are independent UUIDs and are referenced by profiles.branch_id.
alter table public.branches
  drop constraint if exists branches_id_fkey;

insert into public.branches (id, name, city, code)
values
  (gen_random_uuid(), 'Bari', 'Bari', 'BAR'),
  (gen_random_uuid(), 'Bologna', 'Bologna', 'BOL'),
  (gen_random_uuid(), 'Milan', 'Milan', 'MIL'),
  (gen_random_uuid(), 'Naples', 'Naples', 'NAP'),
  (gen_random_uuid(), 'Rome', 'Rome', 'ROM'),
  (gen_random_uuid(), 'Padua', 'Padua', 'PAD'),
  (gen_random_uuid(), 'Palermo', 'Palermo', 'PAL'),
  (gen_random_uuid(), 'Turin', 'Turin', 'TOR')
on conflict (code) do update
set name = excluded.name,
    city = excluded.city;
