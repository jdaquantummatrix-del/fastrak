# CONTEXT.md — Project Kenny domain glossary

The shared vocabulary for the Kennard FoxPro-to-web migration. Add terms as they get resolved.
Project terms (the migration itself) and the **fastrak** application's business domain.

## Migration terms

- **Core module** — one of Kennard's reusable application units, configured per client. Built once.
- **Client / tenant** — one of Kennard's customer companies. Each tenant gets isolated data.
- **fastrak** — the small sample app Kennard sent; our first migration target (tracer bullet).
- **champion** — the large sample app (46 MB); parked until fastrak proves the pipeline.
- **CID convention** — fastrak's tables use a 10-char `CID` primary key; foreign keys are `C…ID`,
  currency fields `Y…`, dates `D…`, logicals `L…`, numerics `N…` (CodeBook framework naming).

## fastrak business domain (a distribution / wholesale trading system)

The flow: **Purchase Order → Inventory → Delivery Receipt → Accounts Receivable → Collection**,
with returns, discounts, and supporting reference data.

### Core entities

- **Customer** (`customer`) — a company fastrak's owner sells to. Has payment terms, address,
  contact, TIN, type. The first slice we rebuild.
- **Item** (`item`) — a product in the catalog. Has code, description, unit + alt unit, pack size,
  base cost (`YBASE`), selling price (`YPRICE`), retail price (`YRETAIL`), and FKs to category,
  brand, supplier. Typed Import/Local.
- **Supplier** (`supplier`) — who items are bought from.
- **Category** (`category`), **Brand** (`brand`), **Unit** (`unit`) — reference/lookup tables for items.
- **Delivery Receipt / DR** (`dr` + `drdet`) — a sale/delivery to a customer. Header has DR number,
  customer, date, terms, discounts, and status flags (`LPOST` posted, `LCANCEL` cancelled,
  `LRCVDR` received). Detail lines list items + quantities.
- **Accounts Receivable / AR** (`ar`) — what a customer owes, per DR/PO, with due date and amount.
- **Collection** (`col` + `coldet`/`coldet2`) — payments received against AR.
- **Return** (`return` + `returndet`) — goods sent back.
- **Inventory** (`inventory`) — stock movement ledger: `NIN`/`NOUT` per item, referencing the
  source document (PO / DR / return / discrepancy).
- **Purchase Order / PO** (`po` + `podet`) — orders placed to suppliers.

### Document states

- **Draft** — a sales/purchase document (DR, PO, Return) that has been started but not yet
  **posted**: editable, possibly incomplete, and with **no effect** on stock, A/R, or money.
- **Posted** — the commit point. Posting enforces the document's rules and applies its
  financial/stock effects (creates A/R, moves inventory, etc.). A posted document is no
  longer a draft.

### Supporting tables

`company` (the business's own info), `bank`, `custdisc` (customer-specific discounts),
`debitdet`, `dscrp`/`dscrpdet` (discrepancies), `id` (id sequence generator), `appdflt` (app
defaults/config), `devnotes`, `dummy`.

## Terms we deliberately avoid

- "Invoice" — fastrak's selling document is a **Delivery Receipt (DR)**; use DR, not invoice,
  when describing fastrak.
