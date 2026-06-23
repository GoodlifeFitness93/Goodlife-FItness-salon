# Goodlife Salon Setup

## Supabase SQL

Paste this into the Supabase SQL editor and run it.

```sql
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
```

## Environment Variables

Create a `.env` file locally and add these values. In Vercel, add the same keys under Project Settings > Environment Variables.

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_DASHBOARD_PIN=
```

- `VITE_SUPABASE_URL`: Your Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon public key.
- `VITE_DASHBOARD_PIN`: Optional 4-digit dashboard PIN. If this is blank or not set, the dashboard opens without a PIN gate.

## Dashboard PIN

Set `VITE_DASHBOARD_PIN` to a 4-digit value, for example:

```bash
VITE_DASHBOARD_PIN=1234
```

The app stores a successful unlock in `sessionStorage`, so the PIN is not re-asked during the same browser session.

## Deploy to Vercel

1. Push this project to a Git repository.
2. In Vercel, choose Add New > Project and import the repository.
3. Keep the default Vite settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optionally `VITE_DASHBOARD_PIN` in Environment Variables.
5. Deploy.

After changing any environment variable in Vercel, redeploy the project so Vite can include the updated values.
