# fastrak — system analysis (migration source)

> Analysis of Kennard's `fastrak` sample app, from the WeTransfer bundle (2026-06-22).
> Source files live in `incoming/fastrak/` (gitignored — proprietary). This doc is the
> distilled, shareable understanding.

## What it is

A **Visual FoxPro** desktop application built on the **CodeBook 3.0 framework**
(`\USR\CDBK30\COMMON30\…`). It's a **distribution / wholesale trading system** — the kind of
back-office app a Philippine SME uses to run purchasing, deliveries, and receivables.

- **27 data tables** (`.DBF`) — the real domain (see `incoming/fastrak-schema.txt` for full schema).
- **88 reports** (`.frx`) — mostly Delivery-Receipt printout variants (priced / no-price / per-printer).
- **5 class libraries** (`.vcx`) — the forms/UI live here (0 standalone `.scx` forms).
- **10 programs** (`.prg`) — thin glue; the heavy logic is in the framework + class libs + reports.

### What we DON'T need

The CodeBook framework (`COMMON30`) is **not** in the zip, and we don't need it. We are not porting
FoxPro — we rebuild the *behaviour* as a web app and migrate the *data* from the `.DBF` tables. The
framework is a legacy implementation detail we discard.

## Business flow

```
 Supplier ──> Purchase Order (po/podet) ──> Inventory (in)
                                               │
 Customer ──> Delivery Receipt (dr/drdet) ──> Inventory (out)
                    │
                    └──> Accounts Receivable (ar) ──> Collection (col/coldet)
                                                   └─> Return (return/returndet)
```

## Naming conventions (CodeBook)

| Prefix | Meaning | Example |
|--------|---------|---------|
| `C…`   | Character | `CNAME`, `CADDRESS` |
| `C…ID` | Foreign key (10-char) | `CCUSTID`, `CCATEGID` |
| `CID`  | Primary key (10-char) | every table |
| `N…`   | Numeric | `NTERMS`, `NPACK` |
| `Y…`   | Currency (8-byte int ÷ 10000) | `YPRICE`, `YBASE` |
| `D…`   | Date (YYYYMMDD) | `DDATE`, `DDUE` |
| `L…`   | Logical (T/F) | `LPOST`, `LCANCEL` |

## Data state

Tables hold **sample/test data only** (customer: 1 row, item: 3 rows, dr: 4 rows, unit: 10 rows;
supplier/brand: empty). Enough to build and verify against. **Action:** later, request a fuller
real-data export from Kennard to test the migration at scale.

---

## First slice: Customer → Postgres (build-ready mapping)

The tracer bullet. `customer.dbf` is flat with no dependencies. Proposed Postgres table:

| DBF field | Type (FoxPro) | → Postgres column | Type | Notes |
|-----------|---------------|-------------------|------|-------|
| `CID`     | Char(10)      | `id`              | `text` PK | Keep the original 10-char id so DR/AR foreign keys still resolve. |
| `CNAME`   | Char(150)     | `name`            | `varchar(150)` | |
| `NTERMS`  | Numeric(10,0) | `terms_days`      | `integer` | Payment terms in days. |
| `CADDRESS`| Char(150)     | `address`         | `varchar(150)` | |
| `CCONTACT`| Char(100)     | `contact_person`  | `varchar(100)` | |
| `CMOBILE` | Char(15)      | `mobile`          | `varchar(15)` | |
| `CTELNO`  | Char(25)      | `tel_no`          | `varchar(25)` | |
| `CFAXNO`  | Char(15)      | `fax_no`          | `varchar(15)` | |
| `CTIN`    | Char(25)      | `tin`             | `varchar(25)` | Tax id number. |
| `CTYPE`   | Char(9)       | `type`            | `varchar(9)` | Customer type/segment. |
| `CREMARKS`| Char(150)     | `remarks`         | `text` | |

**Plus migration metadata:** `tenant_id` (multi-tenant — every row tagged to a client),
`created_at`/`updated_at`. Trim trailing spaces on all char fields during import (FoxPro
fixed-width pads with spaces).

### The slice (vertical, demoable)

> "Migrate `customer.dbf` into Postgres and show a read-only Customer list page in the browser
> displaying the real migrated rows."

Touches every layer — import script (DBF→Postgres) → schema → query → Next.js page — and is
demoable the moment it works. That's the whole point of a tracer bullet.

## Tooling already built (in `incoming/`, gitignored)

- `dbf_schema.py` — dependency-free DBF schema dumper (header only).
- `dbf_data.py` — dependency-free DBF row reader (decodes Char/Numeric/Date/Logical/Currency/Integer).

These become the seed of the real DBF→Postgres import script for the Customer slice.
