# ADR-0003 — Reproduce all of fastrak's reports, via parameterized templates

Status: Accepted (2026-06-23)

## Context

fastrak ships 88 report files (`.frx`). Most are variants of a few core documents — the Delivery
Receipt alone has many forms (priced, no-price, different printers/sizes), plus A/R statements,
collections, inventory, critical-stock, customer-pricing, and discrepancy reports. The choice was
whether to reproduce every report, reproduce only a representative subset, or defer reports.

## Decision

Reproduce **all 88 report outputs** (full document fidelity — chosen deliberately over a reduced
set). Implement them as a **small set of parameterized base templates** — one per distinct document
family (Delivery Receipt, A/R statement, inventory, etc.) — with **variant options** (priced vs
no-price, printer/paper format) rather than 88 separately hand-authored layouts.

## Consequences

- Clients get every printout they have today — nothing they rely on disappears.
- Effort scales with the number of *distinct document families* (~10–15), not 88; variants are
  configuration, not new code.
- Reports for a module are built **after** that module's data exists (e.g. DR reports follow the DR
  module).
- If a future need requires a genuinely bespoke one-off layout that doesn't fit its family's
  template, it can be authored individually as an exception.
- Ruled out: a reduced/representative subset (rejected — clients depend on the specific variants).
