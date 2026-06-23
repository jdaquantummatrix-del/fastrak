# Project Kenny

Web rebuild of Kennard's **fastrak** (Visual FoxPro) distribution system — one vertical slice
at a time. See `CONTEXT.md` for the domain and `docs/analysis/fastrak-overview.md` for the
source-app analysis.

## Stack

- **Next.js** (App Router, TypeScript) — the web app
- **Postgres** — the database. Local dev uses **PGlite** (Postgres in-process, no Docker needed);
  production uses real Postgres via `docker-compose.yml`. Same SQL either way.
- Legacy data is migrated from `.DBF` files using the dependency-free reader in `scripts/dbf.mjs`.

## Run it (local dev)

```bash
npm install
npm run db:setup     # create schema + import customer.dbf into the local PGlite database
npm run dev          # http://localhost:3000
```

Open <http://localhost:3000/customers> to see the migrated customers.

### Scripts

| Script | Does |
|--------|------|
| `npm run db:setup`   | `db:migrate` + `db:import` (local PGlite) |
| `npm run db:migrate` | apply `db/schema.sql` |
| `npm run db:import`  | import `incoming/.../customer.dbf` → `customers` |
| `npm run dev`        | start the Next.js dev server |
| `npm run db:up`      | start Postgres in Docker (for production-like runs / deploy) |

## Status

**Slice 1 — Customer (done):** `customer.dbf` → Postgres `customers` → read-only list page.

Next slices: customer detail + create/edit → items/inventory → delivery receipts (DR) → A/R →
collections. Then repeat the approach for the larger `champion` app.

## Layout

```
app/            Next.js routes (app/customers/page.tsx = the customer list)
lib/db.ts       database access (PGlite locally)
db/schema.sql   Postgres schema
scripts/        DBF reader + migrate/import scripts
docs/           analysis + ADRs + agent config
incoming/       Kennard's raw FoxPro source (gitignored — proprietary)
learning/       Matt Pocock workflow lessons (gitignored)
```
