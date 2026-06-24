# ADR-0004 — Authentication & authorization model

Status: **Proposed** (2026-06-23) — DRAFT, needs a human decision.

> This ADR is intentionally left *Proposed*. The shipped slice (S12, issue #6) is only a
> stopgap shared-password gate. The decision below — what the **real** user/role/permission
> model should be — needs Kennard's input and is the HITL ("human in the loop") part of S12.

## Context

The web rebuild has business modules (customers, items, reference data, company settings)
that anyone reaching the app could currently read and write. We need *some* access control
now so the app isn't wide open, without blocking the module rebuilds on a full identity design.

Two horizons:

1. **Now** — protect the whole app behind a single gate so an unauthenticated visitor can't
   reach any business screen.
2. **Later** — a real per-user model, informed by how fastrak already did security.

### What fastrak's legacy security looks like (the source we must honour later)

fastrak runs on the **CodeBook 3.0** framework, which ships a non-trivial security subsystem.
From `incoming/fastrak/fastrak/SECURITY/`:

- **Object- (control-) level security.** `objsec.prg` scans every class library and records
  each securable UI control (its `cSecurityLabel` / `cDescriptiveName`) into `TABLE2.DBF`.
  So permissions are **fine-grained per control/action**, not just per screen. There is a
  `UserID` concept and at least an `admin` notion.
- **Encrypted at rest.** Security values are stored encrypted (`cData.vcx :: cString::Encrypt()`).
  The `SECURITY/security.dbc` container and the `TABLE1..TABLE5.DBF` payloads read as scrambled
  bytes through a plain DBF reader — we will need the framework's decryption (or a documented
  algorithm) to recover real users, roles, and grants. The raw `FIELDn` columns are not
  directly usable.
- A `TABLE5` config row carries password-policy-looking flags (e.g. a `"90"` that reads like a
  90-day password expiry).
- **`FOXUSER.DBF` is NOT an app user table.** It is VFP's standard resource file (form/window
  positions, etc.), 334 rows of editor state. It must not be mistaken for accounts.

**Implication:** the eventual model isn't a blank slate — there's an existing, granular,
per-control permission scheme with encrypted storage we should reverse-engineer and map, so
migrated tenants keep roughly the access rules they have today.

## Decision (now)

Ship a **shared-password gate** (this slice):

- A single `APP_PASSWORD` (env var) is the only credential. No per-user accounts yet.
- `/login` takes the password; on success we set a **signed, httpOnly** session cookie
  (`fastrak_session`), signed with HMAC-SHA256 over the Web Crypto API so the same helper works in
  both the Edge `middleware.ts` and Node Server Actions. Token carries only issued-at/expiry
  (7-day TTL) — there is no identity to carry.
- `middleware.ts` redirects every request without a valid cookie to `/login` (allowing `/login`
  and static assets). The signing secret is `SESSION_SECRET`, falling back to `APP_PASSWORD`.

This is explicitly **temporary** and stores no user identity.

## Decision (later) — OPEN, needs a human

The real model is undecided. Options on the table:

1. **App-native users + role-based access control (RBAC).** A `users` table (per tenant), a small
   set of roles (e.g. admin / encoder / viewer), permissions attached to roles. Simplest to
   build and reason about; coarser than fastrak's per-control scheme.
2. **Port fastrak's object-level model faithfully.** Reverse-engineer the CodeBook security
   tables (decrypt `TABLE2`/`security.dbc`), migrate per-control grants, reproduce label-level
   checks in the web UI. Highest fidelity, highest effort; ties us to a 1990s control taxonomy.
3. **Hybrid.** App-native RBAC as the spine, with an optional per-control / per-action override
   layer for the few clients who actually rely on fine-grained fastrak grants. Map legacy
   `cSecurityLabel`s onto named permissions during migration.
4. **External identity provider (OIDC/SSO).** Defer auth to a provider; keep only authorization
   (roles/permissions) in-app. Strongest security posture; adds an external dependency that
   conflicts with the hybrid-local / offline-exit goal in ADR-0001/CONTEXT.

### Questions for Kennard (to resolve this ADR)

- Do clients actually *use* fastrak's per-control security, or in practice just a couple of
  roles? (Decides whether option 2's effort is justified.)
- Is multiple named users per client a real requirement on day one, or is one shared login per
  client acceptable for the first online cohort?
- Any password/expiry policy clients expect to keep (the `TABLE5` "90"-day hint)?
- Can we obtain the CodeBook encryption routine, or a decrypted export of the security tables?

## Consequences

- **Now:** no business module is blocked — every screen is protected by one gate. No identity
  data is stored, so there's nothing to migrate or get wrong yet.
- The shared password is a single shared secret: no per-user audit, no revoke-one-user, rotating
  it logs everyone out. Acceptable only as a stopgap.
- Because the gate is centralized in `middleware.ts` + `lib/auth.ts`, swapping in the real model
  later is contained — module code never touches auth.
- Choosing the later model is deferred deliberately; this ADR stays **Proposed** until that
  decision is made, then it (or a superseding ADR-000X) records the accepted model.

## Status / next step

**Needs human review.** Pick a later-model option (or commission the spike to decrypt the
CodeBook security tables) with Kennard, then update this ADR to *Accepted* or supersede it.
