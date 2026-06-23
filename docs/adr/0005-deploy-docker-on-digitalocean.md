# ADR-0005 — Deploy as Docker containers on DigitalOcean (PGlite only for local dev)

Status: Accepted (2026-06-23)

## Context

The converted apps must be hostable online, with the option to run on-premise later (the
"hybrid-local exit"). An earlier infrastructure review chose a Dockerized VPS over a serverless
platform (Vercel) for predictable flat-rate cost, portability, and the ability to drop the same
stack onto a client's local machine. Separately, local development currently uses **PGlite**
(Postgres in WASM) because Docker Hub image pulls are blocked in the current build sandbox.

## Decision

- **Production / hosting target is Docker.** The app (Next.js) and database (Postgres) run as
  containers via `docker-compose`, deployed on a **DigitalOcean droplet** (Hetzner is an acceptable
  cheaper alternative). Object storage (DigitalOcean Spaces / S3-compatible) holds attachments.
  Each client (tenant) gets its own database; several small tenants may share a droplet.
- **Hybrid-local exit stays open.** The identical Docker stack can run on a client's local mini-PC
  to eliminate cloud fees — no code change (ADR-0002's one-time migration makes this clean).
- **PGlite is a local-dev convenience only**, not the deployment story. App code stays
  database-agnostic (same SQL), so PGlite locally and Postgres in Docker are interchangeable. The
  `docker-compose.yml` + `postgres` path is the canonical run target and must be kept working.

## Consequences

- The team can deploy to DigitalOcean (or run locally) whenever desired — the option is preserved
  by construction, not bolted on later.
- We must not let app code depend on PGlite-specific behaviour; keep to standard SQL so the Docker
  Postgres path always works.
- Cost stays predictable (flat-rate droplet), and a client can be moved on-prem without a rewrite.
- Ruled out: serverless/Vercel-style hosting (metered cost, no standard Docker, no co-located DB).
