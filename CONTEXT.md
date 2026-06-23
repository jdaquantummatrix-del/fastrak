# CONTEXT.md — Project Kenny domain glossary

The shared vocabulary for the Kennard FoxPro-to-web migration. Add terms here as they get
resolved (the `/grill-with-docs` skill maintains this lazily — don't pad it with guesses).

## Terms

- **Core module** — one of Kennard's reusable application units (e.g. inventory, invoicing,
  BOM). Built once; configured per client. Not copied/forked per client.
- **Client / tenant** — one of Kennard's ~200 customer companies running the software. Each
  tenant gets isolated data (its own database).
- **Per-client adjustment** — a customization a client asks for. In the web app these are
  **configuration data**, not forked code. (The mechanism for this is still to be designed.)
- **FoxPro source** — the legacy code being migrated: `.PRG` (programs), `.SCX` (forms/screens),
  `.VCX` (class libraries).
- **DBF** — the xBase table files holding the legacy data, to be migrated into Postgres.
- **Tracer bullet** — the first end-to-end slice: one module, one client, FoxPro → web,
  proving the whole pipeline before scaling.
- **Hybrid-local exit** — running the same Docker stack on a client's local mini-PC to
  eliminate cloud fees; their database is dumped from cloud and restored locally.

## Terms we deliberately avoid

_(none yet)_
