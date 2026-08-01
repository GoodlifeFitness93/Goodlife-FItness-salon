-- ====================================================================
-- GOODLIFE SALON - DATABASE MIGRATION SCRIPT (v2 Final)
-- Safe, idempotent SQL script to upgrade existing Supabase database.
-- Run this script in the Supabase SQL Editor.
-- ====================================================================

-- 1. Ensure required extensions
create extension if not exists "pgcrypto";

-- 2. Create public.manager_configs table if not existing
create table if not exists public.manager_configs (
  id uuid primary key default gen_random_uuid(),
  manager_name text not null unique,
  owner_percentage integer not null check (owner_percentage >= 0 and owner_percentage <= 100),
  manager_percentage integer not null check (manager_percentage >= 0 and manager_percentage <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint check_total_hundred check (owner_percentage + manager_percentage = 100)
);

-- 3. Automatic updated_at trigger function & trigger for manager_configs
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_manager_configs on public.manager_configs;
create trigger set_updated_at_manager_configs
  before update on public.manager_configs
  for each row
  execute function public.update_updated_at_column();

-- 4. Add new columns to public.service_entries safely
alter table public.service_entries add column if not exists manager_name text default 'General';
alter table public.service_entries add column if not exists actual_price numeric(10,2);
alter table public.service_entries add column if not exists discount numeric(10,2) default 0;
alter table public.service_entries add column if not exists final_price numeric(10,2);
alter table public.service_entries add column if not exists owner_share numeric(10,2);
alter table public.service_entries add column if not exists manager_share numeric(10,2);

-- 5. Backfill existing legacy records without data loss
update public.service_entries
set 
  actual_price = coalesce(actual_price, total_price),
  discount = coalesce(discount, 0),
  final_price = coalesce(final_price, total_price - coalesce(discount, 0)),
  owner_share = coalesce(owner_share, (total_price - coalesce(discount, 0)) * 0.60),
  manager_share = coalesce(manager_share, (total_price - coalesce(discount, 0)) * 0.40),
  manager_name = coalesce(manager_name, 'General')
where actual_price is null or final_price is null or manager_name is null;

-- 6. Add CHECK constraints to service_entries safely
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'check_discount_non_negative') then
    alter table public.service_entries add constraint check_discount_non_negative check (discount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'check_final_price_non_negative') then
    alter table public.service_entries add constraint check_final_price_non_negative check (final_price >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'check_owner_share_non_negative') then
    alter table public.service_entries add constraint check_owner_share_non_negative check (owner_share >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'check_manager_share_non_negative') then
    alter table public.service_entries add constraint check_manager_share_non_negative check (manager_share >= 0);
  end if;
end $$;

-- 7. Indexes for query optimization
create index if not exists idx_manager_configs_name on public.manager_configs (manager_name);
create index if not exists idx_service_entries_manager on public.service_entries (manager_name);
create index if not exists idx_service_entries_created on public.service_entries (created_at);

-- 8. Enable Row Level Security (RLS)
alter table public.service_entries enable row level security;
alter table public.manager_configs enable row level security;

-- 9. Configure anonymous policies idempotently
drop policy if exists "Allow anon full access service_entries" on public.service_entries;
drop policy if exists "Allow anon select service entries" on public.service_entries;
drop policy if exists "Allow anon insert service entries" on public.service_entries;
drop policy if exists "Allow anon read service entries" on public.service_entries;

create policy "Allow anon full access service_entries"
  on public.service_entries for all to anon using (true) with check (true);

drop policy if exists "Allow anon full access manager_configs" on public.manager_configs;

create policy "Allow anon full access manager_configs"
  on public.manager_configs for all to anon using (true) with check (true);

-- ====================================================================
-- VERIFICATION QUERIES (Run after executing the migration script above)
-- ====================================================================

-- Query A: Verify tables exist
select table_name 
from information_schema.tables 
where table_schema = 'public' 
  and table_name in ('service_entries', 'manager_configs');

-- Query B: Verify service_entries columns
select column_name, data_type, is_nullable, column_default
from information_schema.columns 
where table_schema = 'public' 
  and table_name = 'service_entries'
order by ordinal_position;

-- Query C: Verify manager_configs columns
select column_name, data_type, is_nullable, column_default
from information_schema.columns 
where table_schema = 'public' 
  and table_name = 'manager_configs'
order by ordinal_position;

-- Query D: Verify indexes created
select indexname, tablename 
from pg_indexes 
where schemaname = 'public' 
  and tablename in ('service_entries', 'manager_configs');
