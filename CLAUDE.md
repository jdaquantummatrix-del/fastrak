# CLAUDE.md — Project Kenny

This file guides Claude Code when working in this repo.

## What this is

**Project Kenny** is the home for migrating **Kennard's legacy FoxPro applications** to modern
web apps. Kennard is a long-time FoxPro developer with ~200 corporate clients. He runs a
**core-modules-packaged-per-client** model: a handful of core modules (inventory, invoicing,
BOM, etc.), customized per client. The goal is to rebuild these as a **modern web app** clients
reach through a browser — not just remote access to the old desktop software.

This repo starts as a **test run / scaffold** ("test run of applications that we need to make
for kennard") and will grow into the real build once Kennard provides sample modules and data.

## Status

Day one. No application code yet. The first real step is to get **one core module's FoxPro
source (`.PRG`/`.SCX`/`.VCX`) + a sample `.DBF` dataset for one client**, then build a
tracer-bullet rebuild (one module, one client, end-to-end).

## Key decisions (so far)

- **One multi-tenant codebase**, never forked per client. Per-client differences live as
  **configuration data in the database**, not copied code.
- **Data isolation per client**: each client gets its own database (aids the local-exit dump).
  Run several small clients per droplet; graduate big clients to a dedicated droplet.
- **Infrastructure**: Docker Compose stack (app + Postgres) on a flat-rate VPS — DigitalOcean
  primary, Hetzner as the cheaper alternative. S3-compatible object storage (DO Spaces) for
  receipts/BOM images, never on the app disk. Rejected Vercel (metered billing, no standard
  Docker, no co-located DB).
- **Stack**: lean toward Next.js + Postgres to match the team's familiarity with `qmdi-app`.
- **Hybrid-local exit**: a client can drop cloud fees by running the same Docker stack on a
  local mini-PC; we dump their database and restore it locally.

See `docs/adr/` for hard-to-reverse architectural decisions as they get made, and `CONTEXT.md`
for the project's domain glossary.

## Agent skills

Matt Pocock's engineering skills (installed under `.agents/skills/`) read the config below so
they know how this repo works. Edit `docs/agents/*.md` directly to change any of it.

### Issue tracker

GitHub Issues at `jdaquantummatrix-del/Project-Kenny` (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default 5-role vocabulary — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`,
`wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: `CONTEXT.md` (root) is the domain glossary; `docs/adr/` holds the
hard-to-reverse architectural decisions; `docs/prd/` holds per-module specs. See
`docs/agents/domain.md`.
