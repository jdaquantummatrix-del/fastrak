# ADR-0006 — Document drafts: lenient Save, validate at Post, browser-only auto-save

Status: Accepted (2026-06-24)

## Context

Users build multi-line documents (Delivery Receipt, Purchase Order, Return) and must not lose
work if they're interrupted or need to create a related record (e.g. a customer that doesn't
exist yet) part-way through. We considered database-backed drafts (robust, hand-off-able) versus
browser-only auto-save (simple), and where validation should fire.

## Decision

- **Save is lenient.** A document can be saved while still incomplete — it becomes a **Draft**
  (an unposted document with no effect on stock, A/R, or money). Save does not enforce the full
  business rules.
- **Post is the single strict gate.** All validation (a customer is set, at least one valid line,
  quantities/amounts sane, etc.) runs at **Post**, which is also the commit point that applies the
  financial and inventory effects. Nothing happens until a document is posted, so a sloppy draft is
  harmless.
- **Auto-save is automatic and browser-only.** The in-progress form auto-saves to the browser
  (local storage) and is restored when the user returns in the same browser. There is **no**
  "Save as draft" button and **no** server-side draft record.
- **"+ Add new" mid-document opens a slide-over panel** (no navigation), auto-selecting the new
  record on save — so the browser auto-save is a crash/oops safety net, not the primary
  anti-loss mechanism.

## Consequences

- Much simpler than DB-backed drafts: no draft rows, no draft lifecycle, no cleanup of abandoned
  half-records.
- **Trade-off accepted:** a browser draft is lost if the user clears their cache or switches
  device, and it cannot be handed to a colleague. This is acceptable because the slide-over panel
  (ADR rationale above) handles the common mid-flow case without relying on drafts at all.
- Validation must live at the **Post** boundary, not at Save. A future developer will see Save
  deliberately accept incomplete documents — that is by design, not a bug.
- Ruled out: database-backed drafts (more robust and hand-off-able, but more machinery and junk
  rows); an explicit "Save as draft" button (an extra step the user explicitly didn't want);
  strict-Save (the status quo, which loses in-progress work).
