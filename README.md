# Goodlife Salon

Mobile-first internal revenue tracker PWA for a men's salon.

## Setup

1. Create the Supabase table with `supabase/schema.sql`.
2. Copy `.env.example` to `.env`.
3. Fill in:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_DASHBOARD_PIN=
```

4. Run the app:

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The app includes a web manifest and a basic service worker for PWA installability.
