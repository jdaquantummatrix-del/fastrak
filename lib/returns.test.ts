import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "vitest";
import { createTestDb, asDb } from "./test-db";
import {
  createReturn,
  listReturns,
  getReturn,
  postReturn,
  computeReturnValue,
  returnStatus,
  validateReturnForPost,
  type ReturnLineInput
} from "./returns";
import { createCustomer } from "./customers";
import { createItem } from "./items";
import { createDR, postDR } from "./dr";
import { listAR, balanceForCustomer } from "./ar";
import { currentStock, listMovements, recordMovement } from "./inventory";
import { readDbf } from "../scripts/dbf.mjs";

// A PGlite-backed executor matching the lib/db.ts `query` shape — for reads and the
// read-only helpers. Transactional functions (createReturn/postReturn) take a Db
// built from the same PGlite via asDb.
function executor(db: Awaited<ReturnType<typeof createTestDb>>) {
  return (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, "..", "incoming", "fastrak", "fastrak", "DATA");

// ---------------------------------------------------------------------------
// computeReturnValue — the line money math (mirrors a DR line's net: each line
// rounded to 2dp first, then summed). Returns are valued on NQTY (the unit on
// the line), NOT a pieces expansion — returndet carries no NQTY2/NPACK.
// ---------------------------------------------------------------------------

test("computeReturnValue: a single line with no discounts is qty * price", () => {
  expect(
    computeReturnValue([{ qty: 10, price: "2.00", disc: 0, disc2: 0 }])
  ).toBe("20.00");
});

test("computeReturnValue: a line discount compounds disc then disc2", () => {
  // round((100*1)*(90/100)*(95/100),2) = round(85.5,2) = 85.50
  expect(
    computeReturnValue([{ qty: 1, price: "100.00", disc: 10, disc2: 5 }])
  ).toBe("85.50");
});

test("computeReturnValue: value is the sum of per-line ROUNDED amounts", () => {
  expect(
    computeReturnValue([
      { qty: 3, price: "3.33", disc: 0, disc2: 0 }, // 9.99
      { qty: 1, price: "0.005", disc: 0, disc2: 0 } // round(0.005,2)=0.01
    ])
  ).toBe("10.00");
});

// ---------------------------------------------------------------------------
// CRUD behaviour
// ---------------------------------------------------------------------------

test("createReturn stores the header and its line items", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "Acme Buyer" }, q);
  const widget = await createItem({ code: "WIDGET" }, q);

  const ret = await createReturn(
    {
      return_date: "2024-02-01",
      customer_id: cust.id,
      remarks: "damaged in transit",
      lines: [
        { item_id: widget.id, qty: 5, price: "20.00", disc: 5, unit: "PCS", good: true }
      ]
    },
    d
  );

  expect(ret.id).toHaveLength(10);
  expect(ret.return_date).toBe("2024-02-01");
  expect(ret.customer_id).toBe(cust.id);
  expect(ret.posted).toBe(false);
  expect(ret.lines).toHaveLength(1);
  expect(ret.lines[0]?.price).toBe("20.00"); // exact decimal string
  expect(ret.lines[0]?.qty).toBe(5);
  expect(ret.lines[0]?.disc).toBe("5.00");
  expect(ret.lines[0]?.good).toBe(true);
  // value = round(20*5*0.95, 2) = 95.00
  expect(ret.value).toBe("95.00");
  await db.close();
});

test("listReturns returns headers without lines; getReturn returns lines", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const item = await createItem({ code: "A" }, q);

  const created = await createReturn(
    { return_date: "2024-03-03", lines: [{ item_id: item.id, qty: 1, price: "1.00" }] },
    d
  );

  const list = await listReturns(q);
  expect(list).toHaveLength(1);
  expect(list[0]?.id).toBe(created.id);

  const fetched = await getReturn(created.id, q);
  expect(fetched?.lines).toHaveLength(1);
  expect(fetched?.lines[0]?.qty).toBe(1);
  await db.close();
});

test("getReturn returns null for an unknown id", async () => {
  const db = await createTestDb();
  const q = executor(db);
  expect(await getReturn("NOPE000000", q)).toBeNull();
  await db.close();
});

test("createReturn generates a unique 10-char id and tags tenant fastrak", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const item = await createItem({ code: "T" }, q);

  const a = await createReturn(
    { lines: [{ item_id: item.id, qty: 1, price: "1.00" }] },
    d
  );
  const b = await createReturn({}, d);
  expect(a.id).not.toBe(b.id);
  expect(a.id).toHaveLength(10);

  const hdr = await q("select tenant_id from return where id = $1", [a.id]);
  expect(hdr[0]?.tenant_id).toBe("fastrak");
  const lines = await q("select tenant_id from returndet where return_id = $1", [a.id]);
  expect(lines[0]?.tenant_id).toBe("fastrak");
  await db.close();
});

// ---------------------------------------------------------------------------
// THE KEY INTEGRATION — posting a return raises stock and lowers A/R.
// ---------------------------------------------------------------------------

test("postReturn restocks LGOOD lines (IN) and reduces A/R by the return value", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "Buyer", terms_days: 30 }, q);
  const widget = await createItem({ code: "WIDGET" }, q);
  const gadget = await createItem({ code: "GADGET" }, q);

  // Seed stock and raise an existing A/R for the customer (post a DR).
  await recordMovement({ itemId: widget.id, in: 1000 }, q);
  await recordMovement({ itemId: gadget.id, in: 1000 }, q);
  const dr = await createDR(
    {
      dr_no: "DR-1",
      dr_date: "2024-02-01",
      customer_id: cust.id,
      terms_days: 30,
      lines: [
        { item_id: widget.id, qty: 10, qty2: 10, price: "20.00" },
        { item_id: gadget.id, qty: 10, qty2: 10, price: "8.50" }
      ]
    },
    d
  );
  await postDR(dr.id, d);
  const beforeStockWidget = await currentStock(widget.id, q); // 1000 - 10 = 990
  const beforeStockGadget = await currentStock(gadget.id, q); // 1000 - 10 = 990
  const beforeBalance = await balanceForCustomer(cust.id, q); // 200 + 85 = 285.00
  expect(beforeBalance).toBe("285.00");

  // Return: widget line is GOOD (restocked), gadget line is NOT good (no restock).
  // value = round(20*3,2) + round(8.5*2,2) = 60.00 + 17.00 = 77.00
  const ret = await createReturn(
    {
      return_date: "2024-02-10",
      customer_id: cust.id,
      dr_id: dr.id,
      lines: [
        { item_id: widget.id, qty: 3, price: "20.00", unit: "PCS", good: true },
        { item_id: gadget.id, qty: 2, price: "8.50", unit: "PCS", good: false }
      ]
    },
    d
  );
  expect(ret.value).toBe("77.00");

  const posted = await postReturn(ret.id, d);
  expect(posted.posted).toBe(true);

  // Stock: the GOOD widget line raises stock by 3; the not-good gadget line does NOT.
  expect(await currentStock(widget.id, q)).toBe(beforeStockWidget + 3); // 993
  expect(await currentStock(gadget.id, q)).toBe(beforeStockGadget); // unchanged 990

  // The restock movement is an IN of qty, refType 'return'.
  const moves = await listMovements(q, widget.id);
  const inMove = moves.find((m) => m.return_id === ret.id);
  expect(inMove?.qty_in).toBe(3);
  expect(inMove?.qty_out).toBe(0);
  expect(inMove?.movement_date).toBe("2024-02-10");
  // no movement was written for the not-good gadget line
  expect((await listMovements(q, gadget.id)).find((m) => m.return_id === ret.id)).toBeUndefined();

  // A/R fell by the full return value (77.00): 285.00 - 77.00 = 208.00
  expect(await balanceForCustomer(cust.id, q)).toBe("208.00");
  // The offsetting A/R row is negative and linked to the return.
  const ars = await listAR(q);
  const credit = ars.find((a) => a.return_id === ret.id);
  expect(credit?.amount).toBe("-77.00");
  expect(credit?.customer_id).toBe(cust.id);
  await db.close();
});

test("postReturn is idempotent — posting twice does not double the restock or credit", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "Idem", terms_days: 0 }, q);
  const item = await createItem({ code: "ONCE" }, q);
  await recordMovement({ itemId: item.id, in: 100 }, q);

  const ret = await createReturn(
    {
      return_date: "2024-01-01",
      customer_id: cust.id,
      lines: [{ item_id: item.id, qty: 10, price: "5.00", good: true }]
    },
    d
  );
  await postReturn(ret.id, d);
  expect(await currentStock(item.id, q)).toBe(110);
  expect(await balanceForCustomer(cust.id, q)).toBe("-50.00");

  await postReturn(ret.id, d);
  expect(await currentStock(item.id, q)).toBe(110);
  expect(await balanceForCustomer(cust.id, q)).toBe("-50.00");
  expect((await listAR(q)).filter((a) => a.return_id === ret.id)).toHaveLength(1);
  await db.close();
});

test("postReturn with no GOOD lines still posts and credits A/R but moves no stock", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "AllBad" }, q);
  const item = await createItem({ code: "BAD" }, q);

  const ret = await createReturn(
    {
      return_date: "2024-05-05",
      customer_id: cust.id,
      lines: [{ item_id: item.id, qty: 4, price: "2.00", good: false }]
    },
    d
  );
  const posted = await postReturn(ret.id, d);
  expect(posted.posted).toBe(true);
  expect(await listMovements(q, item.id)).toHaveLength(0);
  // value = 8.00 -> A/R credit of -8.00
  expect(await balanceForCustomer(cust.id, q)).toBe("-8.00");
  await db.close();
});

// ---------------------------------------------------------------------------
// Atomicity / rollback — postReturn writes the restock movements + the A/R credit
// + the posted flag as ONE unit. Forcing a failure partway must leave NO partial
// rows (no movements, no A/R credit, posted still false).
// ---------------------------------------------------------------------------

// A Db that runs a real PGlite transaction but throws when the Nth matching insert
// is attempted inside it — used to break postReturn partway and prove the rollback.
function failingOn(
  db: Awaited<ReturnType<typeof createTestDb>>,
  pattern: RegExp
): import("./db").Db {
  return {
    query: (text, params) =>
      db.query(text, params).then((r) => r.rows as Record<string, unknown>[]),
    transaction: (fn) =>
      db.transaction(async (tx) => {
        const exec = (text: string, params?: unknown[]) => {
          if (pattern.test(text)) {
            throw new Error("injected failure mid-transaction");
          }
          return tx
            .query(text, params)
            .then((r) => r.rows as Record<string, unknown>[]);
        };
        return fn(exec);
      })
  };
}

test("postReturn rolls back the restock AND the A/R credit when posting fails partway", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "Rollback" }, q);
  const item = await createItem({ code: "RB" }, q);
  await recordMovement({ itemId: item.id, in: 100 }, q);

  const ret = await createReturn(
    {
      return_date: "2024-02-01",
      customer_id: cust.id,
      lines: [{ item_id: item.id, qty: 10, price: "5.00", good: true }]
    },
    d
  );

  // Break the final "update return set posted = true": by then the IN movement and
  // the A/R credit have both been written inside the transaction. The throw must roll
  // BOTH back: no movement, no A/R, posted still false.
  const poison = failingOn(db, /update return set posted/i);
  await expect(postReturn(ret.id, poison)).rejects.toThrow();

  expect(await currentStock(item.id, q)).toBe(100); // unchanged
  expect(await balanceForCustomer(cust.id, q)).toBe("0.00"); // no credit
  const moves = await q(
    "select count(*)::int as n from inventory where return_id = $1",
    [ret.id]
  );
  expect((moves[0] as { n: number }).n).toBe(0);
  const reread = await q("select posted from return where id = $1", [ret.id]);
  expect(reread[0]?.posted).toBe(false);

  // A healthy retry posts exactly once.
  await postReturn(ret.id, d);
  expect(await currentStock(item.id, q)).toBe(110);
  expect(await balanceForCustomer(cust.id, q)).toBe("-50.00");
  await db.close();
});

test("createReturn rolls back the header AND all lines when a later line fails", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const good = await createItem({ code: "GOOD" }, q);

  // The second line references a non-existent item -> returndet's item_id FK fails
  // partway. The whole createReturn must roll back: no header, no detail rows.
  await expect(
    createReturn(
      {
        return_date: "2024-02-01",
        lines: [
          { item_id: good.id, qty: 1, price: "1.00" },
          { item_id: "NOSUCHITEM", qty: 1, price: "2.00" }
        ]
      },
      d
    )
  ).rejects.toThrow();

  const headers = await q("select count(*)::int as n from return");
  expect((headers[0] as { n: number }).n).toBe(0);
  const lines = await q("select count(*)::int as n from returndet");
  expect((lines[0] as { n: number }).n).toBe(0);
  await db.close();
});

// ---------------------------------------------------------------------------
// Drafts (ADR-0006): Save is lenient, Post is the strict gate. An incomplete
// return persists as an unposted Draft; postReturn validates and names what is
// missing.
// ---------------------------------------------------------------------------

test("createReturn saves an incomplete return leniently as an unposted Draft", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);

  // No customer, no lines — incomplete, but Save must not enforce business rules.
  const ret = await createReturn({ remarks: "DRAFT-1" }, d);
  expect(ret.id).toHaveLength(10);
  expect(ret.posted).toBe(false);
  expect(ret.customer_id).toBeNull();
  expect(ret.lines).toHaveLength(0);

  // It is persisted and re-readable as a draft.
  const reread = await getReturn(ret.id, q);
  expect(reread?.remarks).toBe("DRAFT-1");
  await db.close();
});

test("returnStatus reports draft / posted", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "Buyer" }, q);
  const item = await createItem({ code: "RS" }, q);

  const draft = await createReturn({ remarks: "ST-1" }, d);
  expect(returnStatus(draft)).toBe("draft");

  const complete = await createReturn(
    {
      customer_id: cust.id,
      lines: [{ item_id: item.id, qty: 1, price: "1.00", good: true }]
    },
    d
  );
  expect(returnStatus(complete)).toBe("draft"); // not yet posted -> still a draft
  const posted = await postReturn(complete.id, d);
  expect(returnStatus(posted)).toBe("posted");
  await db.close();
});

test("validateReturnForPost names every missing piece on an empty draft", async () => {
  const db = await createTestDb();
  const d = asDb(db);
  const ret = await createReturn({ remarks: "EMPTY-V" }, d);
  const problems = validateReturnForPost(ret);
  expect(problems.join(" ").toLowerCase()).toContain("customer");
  expect(problems.join(" ").toLowerCase()).toContain("line");
  await db.close();
});

test("postReturn rejects an incomplete draft with no customer", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const item = await createItem({ code: "NC" }, q);
  const ret = await createReturn(
    { remarks: "NO-CUST", lines: [{ item_id: item.id, qty: 1, price: "1.00", good: true }] },
    d
  );
  await expect(postReturn(ret.id, d)).rejects.toThrow(/customer/i);
  // it stays an unposted draft, no stock moved
  const reread = await getReturn(ret.id, q);
  expect(reread?.posted).toBe(false);
  expect(await currentStock(item.id, q)).toBe(0);
  await db.close();
});

test("postReturn rejects a draft with no valid line", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "B" }, q);
  const ret = await createReturn({ customer_id: cust.id, remarks: "NO-LINE" }, d);
  await expect(postReturn(ret.id, d)).rejects.toThrow(/line/i);
  await db.close();
});

test("postReturn rejects a draft whose only line has a non-positive quantity", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "B" }, q);
  const item = await createItem({ code: "ZQ" }, q);
  const ret = await createReturn(
    {
      customer_id: cust.id,
      lines: [{ item_id: item.id, qty: 0, price: "1.00", good: true }]
    },
    d
  );
  await expect(postReturn(ret.id, d)).rejects.toThrow(/line/i);
  await db.close();
});

test("postReturn rejects a negative price (sane-amount gate)", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "B" }, q);
  const item = await createItem({ code: "NEG" }, q);
  const ret = await createReturn(
    {
      customer_id: cust.id,
      lines: [{ item_id: item.id, qty: 1, price: "-2.00", good: true }]
    },
    d
  );
  await expect(postReturn(ret.id, d)).rejects.toThrow(/price|amount|negative|value/i);
  await db.close();
});

test("postReturn applies stock and A/R when the draft is complete (effects unchanged)", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "Complete Buyer" }, q);
  const item = await createItem({ code: "OK" }, q);
  await recordMovement({ itemId: item.id, in: 100 }, q);

  const ret = await createReturn(
    {
      return_date: "2024-05-01",
      customer_id: cust.id,
      lines: [{ item_id: item.id, qty: 10, price: "5.00", good: true }]
    },
    d
  );
  expect(validateReturnForPost(ret)).toEqual([]);

  const posted = await postReturn(ret.id, d);
  expect(posted.posted).toBe(true);
  expect(await currentStock(item.id, q)).toBe(110);
  expect(await balanceForCustomer(cust.id, q)).toBe("-50.00");
  await db.close();
});

// ---------------------------------------------------------------------------
// FIDELITY — load fastrak's ACTUAL return/returndet sample rows and prove our
// value math reproduces the document, and our LGOOD restock rule matches the
// stored flags (only LGOOD=.T. lines move stock).
// ---------------------------------------------------------------------------

type RetRow = { CID: string; CCUSTID: string; CDRID: string };
type RetDetRow = {
  CRETID: string;
  CITEMID: string;
  NQTY: number | null;
  YPRICE: number | null;
  NDISC: number | null;
  NDISC2: number | null;
  LGOOD: boolean | null;
};

function loadFastrak() {
  const ret = readDbf(path.join(DATA, "return.dbf")).records as unknown as RetRow[];
  const det = readDbf(path.join(DATA, "returndet.dbf"))
    .records as unknown as RetDetRow[];
  return { ret, det };
}

function linesFor(det: RetDetRow[], retId: string): ReturnLineInput[] {
  return det
    .filter((d) => d.CRETID.trim() === retId.trim())
    .map((d) => ({
      qty: d.NQTY ?? 0,
      price: d.YPRICE == null ? null : Number(d.YPRICE).toFixed(2),
      disc: d.NDISC ?? 0,
      disc2: d.NDISC2 ?? 0,
      good: d.LGOOD === true
    }));
}

test("fidelity: the fastrak sample return values exactly", () => {
  const { ret, det } = loadFastrak();
  expect(ret.length).toBeGreaterThan(0);
  // return CID 17: lines 20*2*0.95=38.00, 8.5*2=17.00, 2*1=2.00 -> 57.00
  const r17 = ret.find((r) => r.CID.trim() === "17")!;
  expect(computeReturnValue(linesFor(det, r17.CID))).toBe("57.00");
});

test("fidelity: only LGOOD lines would restock; the sample has exactly one", () => {
  const { ret, det } = loadFastrak();
  const r17 = ret.find((r) => r.CID.trim() === "17")!;
  const good = linesFor(det, r17.CID).filter((l) => l.good);
  // In the sample only the gadget line (CID 1X) carries LGOOD=.T.
  expect(good).toHaveLength(1);
  expect(good[0]?.qty).toBe(2);
});
