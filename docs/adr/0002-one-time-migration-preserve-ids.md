# ADR-0002 — One-time per-tenant data migration, preserving legacy IDs

Status: Accepted (2026-06-23)

## Context

Each client currently runs fastrak locally against `.DBF` tables. To move them online we must get
their data into the web app's Postgres database. Options ranged from a one-time import to keeping
FoxPro and the web app continuously in sync during a transition.

## Decision

- Each client's data is migrated **once, at cutover**, from their `.DBF` files into their own
  Postgres database. There is **no live two-way sync** with the FoxPro app.
- The migration **preserves fastrak's legacy 10-char `CID` primary keys** (and the `C…ID` foreign
  keys that reference them). New records created in the web app get newly generated 10-char ids in
  the same format.

## Consequences

- Foreign keys (DR → customer, A/R → DR, inventory → item, etc.) resolve unchanged after import,
  so we don't have to remap relationships.
- After cutover, the FoxPro app is read-only history for that client; the web app is the system of
  record. No dual-write complexity, no sync conflicts.
- Requires a clean cutover per client and a fuller real-data export from Kennard (current samples
  are test rows).
- Ruled out: live sync (too complex/risky) and fresh-ID remapping (needless FK churn).
