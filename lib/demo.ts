// Loadable + wipeable demo dataset (slice S8, issue #25). One coherent scenario
// that spans the whole distribution flow — reference data, a product catalog, a
// spread of customers, purchase orders received into stock, delivery receipts
// (several Posted so A/R + Collections + aging show balances, one or two left as
// Drafts per ADR-0006), a collection or two, and a return.
//
// It is built by calling the REAL lib create/post functions (createItem,
// createPO/receivePO, createDR/postDR, recordCollection, createReturn/postReturn),
// so the demo exercises exactly the same money/stock/A-R machinery as real data —
// no hand-written rows that could drift from the production code path.
//
// Separability (the load/wipe contract): every row the loader creates is recorded
// in the `demo_data` registry (db/schema/0024_demo_data.sql). wipeDemoData deletes
// exactly the registered rows, in FK-safe order, and nothing else — so a client's
// real data (never registered) is never touched. Run it via the npm scripts
// `demo:load` / `demo:wipe`.
import { newId, clean } from "./reference";
import { type Db, appDb } from "./db";
import { createUnit } from "./units";
import { createCategory } from "./categories";
import { createBrand } from "./brands";
import { createSupplier } from "./suppliers";
import { createCustomer } from "./customers";
import { createItem, type Item } from "./items";
import { createPO, receivePO } from "./po";
import { createDR, postDR } from "./dr";
import { recordCollection } from "./collections";
import { createReturn, postReturn } from "./returns";
import { listAR } from "./ar";

// What loadDemoData reports back: a count per entity, so the npm script (and the
// test) can confirm the scenario landed.
export type DemoSummary = {
  units: number;
  categories: number;
  brands: number;
  suppliers: number;
  customers: number;
  items: number;
  purchaseOrders: number;
  deliveryReceipts: number;
  collections: number;
  returns: number;
};

// The demo doc dates are anchored in early 2024 so that, relative to today (and to
// the tests' far-future asOf), the posted receivables are genuinely overdue and
// land in the aging buckets — Collections and the A/R aging report then have real
// balances to show. A short helper keeps the dates readable below.
const D = {
  po1: "2024-01-15",
  po2: "2024-01-20",
  po3: "2024-02-01",
  dr1: "2024-02-10", // posted, oldest -> deepest aging bucket
  dr2: "2024-03-05", // posted
  dr3: "2024-04-12", // posted
  dr4: "2024-05-20", // draft (left unposted per ADR-0006)
  dr5: "2024-06-01", // draft
  col1: "2024-05-01",
  col2: "2024-06-15",
  ret1: "2024-04-20"
};

// ── the registry (the load/wipe separator) ───────────────────────────────────

// An executor: the shape lib/db.ts queries take. We thread one through the loader so
// every "register this demo row" insert runs on the same connection as the creates.
type Exec = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

// Record that `rowId` in `table` is demo data, so wipe can find and remove exactly it.
// Idempotent (ON CONFLICT DO NOTHING against the unique (table_name,row_id) index).
async function register(exec: Exec, table: string, rowId: string): Promise<void> {
  await exec(
    `insert into demo_data (id, tenant_id, table_name, row_id)
       values ($1,'fastrak',$2,$3)
     on conflict (table_name, row_id) do nothing`,
    [newId(), table, rowId]
  );
}

// Has demo data been loaded? True when the registry holds at least one row.
export async function isDemoLoaded(exec: Exec): Promise<boolean> {
  const rows = (await exec(`select 1 from demo_data limit 1`)) as unknown[];
  return rows.length > 0;
}

// The tables that hold demo rows, listed CHILD-FIRST so deleting in this order never
// violates a foreign key (e.g. coldet before ar, drdet before dr, ar before customers).
// Each demo row is registered under exactly one of these names.
const WIPE_ORDER = [
  "coldet",
  "col",
  "returndet",
  "return",
  "inventory",
  "ar",
  "drdet",
  "dr",
  "podet",
  "po",
  "items",
  "customers",
  "suppliers",
  "brands",
  "categories",
  "units"
] as const;

// ── load ──────────────────────────────────────────────────────────────────────

// Build the full demo scenario. Idempotent: if demo data is already loaded it is a
// no-op (so re-running `demo:load` never doubles the data). Everything runs inside one
// transaction — a failure partway leaves NO partial demo rows AND no orphan registry
// entries, so the dataset is always all-or-nothing.
export async function loadDemoData(db: Db = appDb): Promise<DemoSummary> {
  return db.transaction(async (exec) => {
    if (await isDemoLoaded(exec)) {
      return countExisting(exec);
    }

    // The lib create/post functions take a `Db`. Inside this transaction we hand them
    // a thin Db whose query AND transaction both reuse THIS exec — so their inserts,
    // movements and A/R writes join our single demo transaction (PGlite has one
    // connection; a nested BEGIN would deadlock). register() uses the same exec.
    const inner: Db = {
      query: (text, params) => exec(text, params),
      transaction: (fn) => fn(exec)
    };

    // 1) Reference data ───────────────────────────────────────────────────────
    const units: Record<string, string> = {};
    for (const u of ["PC", "BOX", "CASE", "PACK"]) {
      const row = await createUnit({ unit: u }, exec);
      await register(exec, "units", row.id);
      units[u] = row.id;
    }

    const categories: Record<string, string> = {};
    for (const c of ["Beverages", "Snacks", "Household", "Personal Care"]) {
      const row = await createCategory({ category: c }, exec);
      await register(exec, "categories", row.id);
      categories[c] = row.id;
    }

    const brands: Record<string, string> = {};
    for (const b of ["Acme", "Globex", "Initech"]) {
      const row = await createBrand({ brand: b }, exec);
      await register(exec, "brands", row.id);
      brands[b] = row.id;
    }

    // 2) Suppliers ─────────────────────────────────────────────────────────────
    const suppliers: string[] = [];
    for (const s of [
      { name: "Sunrise Trading", is_local: true, terms_days: 30 },
      { name: "Metro Distributors", is_local: true, terms_days: 45 },
      { name: "Pacific Imports", is_local: false, terms_days: 60 }
    ]) {
      const row = await createSupplier(s, exec);
      await register(exec, "suppliers", row.id);
      suppliers.push(row.id);
    }

    // 3) Customers across types. customers.type is varchar(9) (fastrak CTYPE), so
    //    the labels here are kept <=9 chars — "Wholesale" and "Retail" match the
    //    pre-seeded customer_types; "Walk-in" is a conventional fastrak third type
    //    that fits the width (the seeded "Distributor" label is 11 chars and would
    //    overflow CTYPE, so it isn't used here). ───────────────────────────────
    const customers: { id: string; terms: number }[] = [];
    const customerDefs = [
      { name: "Bayside Mart", type: "Retail", terms_days: 15 },
      { name: "Northgate Grocery", type: "Retail", terms_days: 30 },
      { name: "Citywide Wholesale", type: "Wholesale", terms_days: 30 },
      { name: "Harbor Supply Co", type: "Wholesale", terms_days: 45 },
      { name: "Summit Outlet", type: "Walk-in", terms_days: 60 },
      { name: "Valley Network", type: "Walk-in", terms_days: 45 },
      { name: "Corner Store Express", type: "Retail", terms_days: 15 }
    ];
    for (const c of customerDefs) {
      const row = await createCustomer(c, exec);
      await register(exec, "customers", row.id);
      customers.push({ id: row.id, terms: c.terms_days });
    }

    // 4) Items — 11 across categories/brands/units, with cost + sell prices ────
    const itemDefs: Array<{
      code: string;
      description: string;
      category: string;
      brand: string;
      base_cost: string;
      price: string;
      retail: string;
      unit: string;
      pack_size: number;
    }> = [
      { code: "BEV-COLA", description: "Cola 330ml", category: "Beverages", brand: "Acme", base_cost: "8.00", price: "12.00", retail: "15.00", unit: "BOX", pack_size: 24 },
      { code: "BEV-WATER", description: "Bottled Water 500ml", category: "Beverages", brand: "Globex", base_cost: "5.00", price: "8.00", retail: "10.00", unit: "BOX", pack_size: 24 },
      { code: "BEV-JUICE", description: "Orange Juice 1L", category: "Beverages", brand: "Acme", base_cost: "20.00", price: "28.00", retail: "35.00", unit: "CASE", pack_size: 12 },
      { code: "SNK-CHIPS", description: "Potato Chips 150g", category: "Snacks", brand: "Globex", base_cost: "10.00", price: "15.00", retail: "20.00", unit: "BOX", pack_size: 48 },
      { code: "SNK-NUTS", description: "Mixed Nuts 200g", category: "Snacks", brand: "Initech", base_cost: "25.00", price: "35.00", retail: "45.00", unit: "BOX", pack_size: 24 },
      { code: "SNK-CANDY", description: "Candy Assortment", category: "Snacks", brand: "Acme", base_cost: "12.00", price: "18.00", retail: "24.00", unit: "PACK", pack_size: 50 },
      { code: "HH-SOAP", description: "Dish Soap 1L", category: "Household", brand: "Initech", base_cost: "30.00", price: "42.00", retail: "55.00", unit: "CASE", pack_size: 12 },
      { code: "HH-BLEACH", description: "Bleach 1L", category: "Household", brand: "Globex", base_cost: "18.00", price: "26.00", retail: "33.00", unit: "CASE", pack_size: 12 },
      { code: "HH-TISSUE", description: "Tissue Roll 12pk", category: "Household", brand: "Acme", base_cost: "40.00", price: "55.00", retail: "70.00", unit: "PACK", pack_size: 6 },
      { code: "PC-SHAMPOO", description: "Shampoo 400ml", category: "Personal Care", brand: "Initech", base_cost: "45.00", price: "62.00", retail: "80.00", unit: "BOX", pack_size: 12 },
      { code: "PC-TOOTH", description: "Toothpaste 150g", category: "Personal Care", brand: "Globex", base_cost: "22.00", price: "30.00", retail: "38.00", unit: "BOX", pack_size: 24 }
    ];
    const items: Item[] = [];
    for (let i = 0; i < itemDefs.length; i++) {
      const def = itemDefs[i]!;
      const row = await createItem(
        {
          code: def.code,
          description: def.description,
          category_id: categories[def.category],
          brand_id: brands[def.brand],
          supplier_id: suppliers[i % suppliers.length],
          base_cost: def.base_cost,
          price: def.price,
          retail: def.retail,
          unit: def.unit,
          unit2: "PC",
          pack_size: def.pack_size,
          critical: 5
        },
        exec
      );
      await register(exec, "items", row.id);
      items.push(row);
    }
    const itemPackSize: Record<string, number> = {};
    for (let i = 0; i < items.length; i++) {
      itemPackSize[items[i]!.id] = itemDefs[i]!.pack_size;
    }

    // 5) Purchase orders — 3, each received into stock (the only thing that puts
    //    stock on the shelf, so DRs further down have something to deliver). ─────
    const poPlan = [
      { date: D.po1, supplier: 0, idx: [0, 1, 2, 3] },
      { date: D.po2, supplier: 1, idx: [4, 5, 6, 7] },
      { date: D.po3, supplier: 2, idx: [8, 9, 10] }
    ];
    let poCount = 0;
    for (let p = 0; p < poPlan.length; p++) {
      const plan = poPlan[p]!;
      const po = await createPO(
        {
          po_no: `DEMO-PO-${String(p + 1).padStart(3, "0")}`,
          po_date: plan.date,
          supplier_id: suppliers[plan.supplier],
          remarks: "Demo purchase order",
          lines: plan.idx.map((i) => ({
            item_id: items[i]!.id,
            qty: 100,
            base_cost: itemDefs[i]!.base_cost,
            unit: itemDefs[i]!.unit
          }))
        },
        inner
      );
      await register(exec, "po", po.id);
      for (const l of po.lines) await register(exec, "podet", l.id);
      await receivePO(po.id, inner);
      poCount++;
    }
    // Register the inventory IN movements the receives wrote (one per PO line).
    await registerInventoryByRef(exec, "po");

    // 6) Delivery receipts — 5: three posted (raise A/R), two left as drafts. ──
    //    qty2 (pieces) drives the money + stock-out, so we sell modest piece counts
    //    well within the ~100*pack_size pieces each received PO put on the shelf.
    const drPlan = [
      { date: D.dr1, cust: 0, post: true, lines: [[0, 10], [3, 8]], doc_disc: 0, add_pct: 0 },
      { date: D.dr2, cust: 2, post: true, lines: [[4, 6], [6, 4], [9, 5]], doc_disc: 2, add_pct: 0 },
      { date: D.dr3, cust: 4, post: true, lines: [[1, 12], [10, 6]], doc_disc: 0, add_pct: 1 },
      { date: D.dr4, cust: 1, post: false, lines: [[5, 5]], doc_disc: 0, add_pct: 0 },
      { date: D.dr5, cust: 3, post: false, lines: [[7, 4], [8, 3]], doc_disc: 0, add_pct: 0 }
    ];
    let drCount = 0;
    const postedDrCustomers: string[] = [];
    for (let i = 0; i < drPlan.length; i++) {
      const plan = drPlan[i]!;
      const customer = customers[plan.cust]!;
      const dr = await createDR(
        {
          dr_no: `DEMO-DR-${String(i + 1).padStart(3, "0")}`,
          dr_date: plan.date,
          customer_id: customer.id,
          terms_days: customer.terms,
          doc_disc: plan.doc_disc,
          add_pct: plan.add_pct,
          remarks: plan.post ? "Demo delivery (posted)" : "Demo delivery (draft)",
          lines: plan.lines.map(([idx, pieces]) => {
            const item = items[idx!]!;
            const pack = itemPackSize[item.id]!;
            return {
              item_id: item.id,
              qty: Math.max(1, Math.round(pieces! / pack)),
              qty2: pieces!,
              price: itemDefs[idx!]!.price,
              base_cost: itemDefs[idx!]!.base_cost,
              unit: itemDefs[idx!]!.unit,
              unit2: "PC",
              pack_size: pack
            };
          })
        },
        inner
      );
      await register(exec, "dr", dr.id);
      for (const l of dr.lines) await register(exec, "drdet", l.id);
      if (plan.post) {
        await postDR(dr.id, inner);
        postedDrCustomers.push(customer.id);
      }
      drCount++;
    }
    // Register the OUT movements + A/R rows the posts wrote.
    await registerInventoryByRef(exec, "dr");
    await registerARForDemoDRs(exec);

    // 7) Collections — 2: a customer pays down (most of) their oldest receivable,
    //    leaving partial/aged balances so Collections + aging stay interesting. ──
    let colCount = 0;
    const ar = await listAR((t, p) => exec(t, p));
    const arByCustomer = new Map<string, typeof ar>();
    for (const row of ar) {
      if (Number(row.amount) <= 0) continue; // skip return credits
      const list = arByCustomer.get(row.customer_id ?? "") ?? [];
      list.push(row);
      arByCustomer.set(row.customer_id ?? "", list);
    }
    const colPlan = [
      { date: D.col1, cust: postedDrCustomers[0], factor: 0.5 },
      { date: D.col2, cust: postedDrCustomers[1], factor: 1 }
    ];
    for (const plan of colPlan) {
      if (!plan.cust) continue;
      const rows = arByCustomer.get(plan.cust) ?? [];
      if (rows.length === 0) continue;
      const target = rows[0]!;
      const amount = (Number(target.amount) * plan.factor).toFixed(2);
      if (Number(amount) <= 0) continue;
      const col = await recordCollection(
        {
          col_date: plan.date,
          customer_id: plan.cust,
          remarks: "Demo collection",
          lines: [{ ar_id: target.id, amount }]
        },
        inner
      );
      await register(exec, "col", col.id);
      for (const l of col.lines) await register(exec, "coldet", l.id);
      colCount++;
    }

    // 8) A return — a posted DR's customer sends a few good pieces back (restocks
    //    + credits A/R). Tied to the first posted DR's customer/item. ────────────
    let retCount = 0;
    if (postedDrCustomers[0]) {
      const ret = await createReturn(
        {
          return_date: D.ret1,
          customer_id: postedDrCustomers[0],
          type: "good",
          remarks: "Demo return",
          lines: [
            {
              item_id: items[0]!.id,
              qty: 2,
              price: itemDefs[0]!.price,
              base_cost: itemDefs[0]!.base_cost,
              good: true
            }
          ]
        },
        inner
      );
      await register(exec, "return", ret.id);
      for (const l of ret.lines) await register(exec, "returndet", l.id);
      await postReturn(ret.id, inner);
      retCount++;
    }
    await registerInventoryByRef(exec, "return");
    await registerARForDemoReturns(exec);

    return {
      units: 4,
      categories: 4,
      brands: 3,
      suppliers: suppliers.length,
      customers: customers.length,
      items: items.length,
      purchaseOrders: poCount,
      deliveryReceipts: drCount,
      collections: colCount,
      returns: retCount
    };
  });
}

// Register every inventory movement whose ref points at an already-registered
// document of `kind` (po/dr/return) — these rows are written by receivePO/postDR/
// postReturn, so we sweep them up afterwards rather than threading ids by hand.
async function registerInventoryByRef(
  exec: Exec,
  kind: "po" | "dr" | "return"
): Promise<void> {
  const col = kind === "po" ? "po_id" : kind === "dr" ? "dr_id" : "return_id";
  await exec(
    `insert into demo_data (id, tenant_id, table_name, row_id)
       select substr(md5(random()::text || inv.id), 1, 10), 'fastrak', 'inventory', inv.id
         from inventory inv
        where inv.${col} in (select row_id from demo_data where table_name = $1)
          and not exists (
            select 1 from demo_data d
             where d.table_name = 'inventory' and d.row_id = inv.id
          )`,
    [kind]
  );
}

// Register the A/R rows raised by the demo's posted DRs (postDR inserts them).
async function registerARForDemoDRs(exec: Exec): Promise<void> {
  await exec(
    `insert into demo_data (id, tenant_id, table_name, row_id)
       select substr(md5(random()::text || a.id), 1, 10), 'fastrak', 'ar', a.id
         from ar a
        where a.dr_id in (select row_id from demo_data where table_name = 'dr')
          and not exists (
            select 1 from demo_data d where d.table_name = 'ar' and d.row_id = a.id
          )`
  );
}

// Register the A/R credit rows raised by the demo's posted returns.
async function registerARForDemoReturns(exec: Exec): Promise<void> {
  await exec(
    `insert into demo_data (id, tenant_id, table_name, row_id)
       select substr(md5(random()::text || a.id), 1, 10), 'fastrak', 'ar', a.id
         from ar a
        where a.return_id in (select row_id from demo_data where table_name = 'return')
          and not exists (
            select 1 from demo_data d where d.table_name = 'ar' and d.row_id = a.id
          )`
  );
}

// Count what is already loaded (used by the idempotent early-return path) so a repeat
// load still returns an accurate summary without rebuilding anything.
async function countExisting(exec: Exec): Promise<DemoSummary> {
  const count = async (table: string) => {
    const rows = (await exec(
      `select count(*)::int as n from demo_data where table_name = $1`,
      [table]
    )) as { n: number }[];
    return rows[0]?.n ?? 0;
  };
  return {
    units: await count("units"),
    categories: await count("categories"),
    brands: await count("brands"),
    suppliers: await count("suppliers"),
    customers: await count("customers"),
    items: await count("items"),
    purchaseOrders: await count("po"),
    deliveryReceipts: await count("dr"),
    collections: await count("col"),
    returns: await count("return")
  };
}

// ── wipe ────────────────────────────────────────────────────────────────────

// How many rows wipeDemoData removed, in total.
export type WipeResult = { removed: number };

// Remove every demo row — and ONLY demo rows — in one transaction. Walks the wipe
// order child-first so no foreign key is ever violated, deleting each table's rows by
// the ids the registry recorded, then clears the registry itself. Real data, never in
// the registry, is left untouched. Idempotent: wiping when nothing is loaded is a no-op.
export async function wipeDemoData(db: Db = appDb): Promise<WipeResult> {
  return db.transaction(async (exec) => {
    let removed = 0;
    for (const table of WIPE_ORDER) {
      const rows = (await exec(
        // identifier can't be parameterised; table is from our fixed WIPE_ORDER list,
        // never user input, so the interpolation is safe.
        `delete from ${table}
           where id in (select row_id from demo_data where table_name = $1)
         returning id`,
        [table]
      )) as unknown[];
      removed += rows.length;
    }
    await exec(`delete from demo_data`);
    return { removed };
  });
}
