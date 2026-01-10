# CashCove

Personal finance cockpit for budgets, expenses, and goal tracking (Phase 1: budget + expenses).

## Stack
- Vite + React + TypeScript
- Redux Toolkit + RTK Query
- Supabase (Auth + Postgres)
- Recharts

## Setup
1) Install dependencies
```bash
npm install
```

2) Create a Supabase project
- Run the SQL in `supabase/schema.sql` in the Supabase SQL editor.

3) Configure env vars
- Copy `.env.example` to `.env` and fill in:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

4) Run the app
```bash
npm run dev
```

## Notes
- Encryption is currently disabled; notes are stored as plain text.
- Default categories and payment methods are auto-seeded on first login.
- Budgets are soft caps; alerts will be added in Phase 2.
