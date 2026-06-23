create extension if not exists "pgcrypto";

create table if not exists public.service_entries (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  phone_number text not null,
  services text[] not null,
  custom_service text,
  total_price numeric(10,2) not null,
  payment_method text not null check (payment_method in ('Cash', 'Card', 'Online UPI')),
  created_at timestamptz not null default now(),
  entry_month text not null
);

alter table public.service_entries enable row level security;

create policy "Allow anon insert service entries"
  on public.service_entries
  for insert
  to anon
  with check (true);

create policy "Allow anon read service entries"
  on public.service_entries
  for select
  to anon
  using (true);
