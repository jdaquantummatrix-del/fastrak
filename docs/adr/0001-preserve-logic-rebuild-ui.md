# ADR-0001 — Preserve fastrak's logic and data; rebuild the UI

Status: Accepted (2026-06-23)

## Context

We are converting Kennard's existing, finished FoxPro application (`fastrak`) into a web app. The
old app's business rules and data are battle-tested and trusted by real clients; its UI is a dated
FoxPro desktop interface. "Convert the app" could mean replicating the old screens, freely
redesigning, or something between.

## Decision

The conversion **preserves fastrak's business rules and data with exact fidelity, and rebuilds the
UI as fresh, modern web screens.** We do not replicate the FoxPro look-and-feel. Business logic
(how a Delivery Receipt posts, how A/R is computed, how discounts/terms/units behave, money math)
is treated as the specification and must match the legacy app. The presentation layer is ours to
design for the web.

## Consequences

- **What must match exactly:** the data model, calculations, document contents, and business rules.
  These are the source of truth and the basis for tests.
- **What we are free to change:** screen layout, navigation, visual design, and interaction patterns.
- Verification of a converted module means "same data + same numbers + same documents as fastrak,"
  not "same screen as fastrak."
- This rules out a pixel-faithful replica and rules out redesigning business workflows.
