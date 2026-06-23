import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "vitest";
import { createTestDb, asDb } from "./test-db";
import {
  createDR,
  updateDR,
  listDRs,
  getDR,
  postDR,
  cancelDR,
  computeDRTotals,
  type DRLineInput
} from "./dr";
import { createCustomer } from "./customers";
import { createItem } from "./items";
import { currentStock, listMovements } from "./inventory";
import { readDbf } from "../scripts/dbf.mjs";

// A PGlite-backed executor matching the lib/db.ts `query` shape — for reads and
// the read-only helpers. Transactional functions (createDR/updateDR/postDR/
// cancelDR) take a Db instead, built from the same PGlite via asDb.
function executor(db: Awaited<ReturnType<typeof createTestDb>>) {
  return (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, "..", "incoming", "fastrak", "fastrak", "DATA");

// ---------------------------------------------------------------------------
// Calculation unit tests — assert the NUMBERS against fastrak's exact formulas
// (recovered from LIBS/abizness.vct; see lib/dr.ts header).
// ---------------------------------------------------------------------------

test("computeDRTotals: a single line with no discounts", () => {
  // gross = qty2 * price; with no discounts net == gross, total == net
  const totals = computeDRTotals(
    { doc_disc: 0, add_pct: 0 },
    [{ qty2: 10, price: "2.00", disc: 0, disc2: 0 }]
  );
  expect(totals.gross).toBe("20.00");
  expect(totals.net).toBe("20.00");
  expect(totals.add_amount).toBe("0.00");
  expect(totals.doc_disc_amount).toBe("0.00");
  expect(totals.total).toBe("20.00");
});

test("computeDRTotals: a line discount compounds disc then disc2", () => {
  // round((100*1)*(90/100)*(95/100),2) = round(85.5,2) = 85.50
  const totals = computeDRTotals(
    { doc_disc: 0, add_pct: 0 },
    [{ qty2: 1, price: "100.00", disc: 10, disc2: 5 }]
  );
  expect(totals.gross).toBe("100.00");
  expect(totals.net).toBe("85.50");
  expect(totals.total).toBe("85.50");
});

test("computeDRTotals: net is the sum of per-line ROUNDED amounts", () => {
  // each line rounded to 2dp first, then summed (matches fastrak getdiscount)
  const totals = computeDRTotals({ doc_disc: 0, add_pct: 0 }, [
    { qty2: 3, price: "3.33", disc: 0, disc2: 0 }, // 9.99
    { qty2: 1, price: "0.005", disc: 0, disc2: 0 } // round(0.005,2)=0.01 (round-half-up)
  ]);
  expect(totals.net).toBe("10.00");
});

test("computeDRTotals: add-on % and document discount % apply to net", () => {
  // net = 1000; add = round(1000*0.05,2)=50; docdisc = round(1000*0.03,2)=30
  // total = (1000 + 50) - 30 = 1020
  const totals = computeDRTotals(
    { doc_disc: 3, add_pct: 5 },
    [{ qty2: 100, price: "10.00", disc: 0, disc2: 0 }]
  );
  expect(totals.net).toBe("1000.00");
  expect(totals.add_amount).toBe("50.00");
  expect(totals.doc_disc_amount).toBe("30.00");
  expect(totals.total).toBe("1020.00");
});

// ---------------------------------------------------------------------------
// CRUD behaviour
// ---------------------------------------------------------------------------

test("createDR stores the header and its line items, computing add_amount", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const cust = await createCustomer({ name: "Acme Buyer", terms_days: 30 }, q);
  const widget = await createItem({ code: "WIDGET" }, q);

  const dr = await createDR(
    {
      dr_no: "DR-001",
      dr_date: "2024-02-01",
      customer_id: cust.id,
      terms_days: 30,
      doc_disc: 3,
      add_pct: 5,
      remarks: "rush",
      lines: [
        { item_id: widget.id, qty: 5, qty2: 240, price: "20.00", disc: 5, unit: "BOX" }
      ]
    },
    d
  );

  expect(dr.id).toHaveLength(10);
  expect(dr.dr_no).toBe("DR-001");
  expect(dr.dr_date).toBe("2024-02-01");
  expect(dr.customer_id).toBe(cust.id);
  expect(dr.posted).toBe(false);
  expect(dr.cancelled).toBe(false);
  expect(dr.lines).toHaveLength(1);
  // money round-trips as an exact decimal string (no float drift)
  expect(dr.lines[0]?.price).toBe("20.00");
  expect(dr.lines[0]?.qty2).toBe(240);
  expect(dr.lines[0]?.disc).toBe("5.00");

  // header carries the computed currency totals
  // net = round(20*240*0.95,2) = 4560.00 ; add = 4560*0.05=228 ; doc = 4560*0.03=136.80
  expect(dr.add_amount).toBe("228.00");
  expect(dr.total).toBe("4651.20"); // (4560 + 228) - 136.80
  await db.close();
});

test("listDRs returns headers without lines; getDR returns lines", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const item = await createItem({ code: "A" }, q);

  const created = await createDR(
    { dr_no: "DR-9", lines: [{ item_id: item.id, qty: 1, qty2: 3, price: "1.00" }] },
    d
  );

  const list = await listDRs(q);
  expect(list).toHaveLength(1);
  expect(list[0]?.id).toBe(created.id);
  expect(list[0]?.dr_no).toBe("DR-9");

  const fetched = await getDR(created.id, q);
  expect(fetched?.lines).toHaveLength(1);
  expect(fetched?.lines[0]?.qty2).toBe(3);
  await db.close();
});

test("getDR returns null for an unknown id", async () => {
  const db = await createTestDb();
  const q = executor(db);
  expect(await getDR("NOPE000000", q)).toBeNull();
  await db.close();
});

test("createDR generates a unique 10-char id and tags tenant fastrak", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const item = await createItem({ code: "T" }, q);

  const a = await createDR(
    { dr_no: "X", lines: [{ item_id: item.id, qty: 1, qty2: 1, price: "1.00" }] },
    d
  );
  const b = await createDR({ dr_no: "Y" }, d);
  expect(a.id).not.toBe(b.id);
  expect(a.id).toHaveLength(10);

  const hdr = await q("select tenant_id from dr where id = $1", [a.id]);
  expect(hdr[0]?.tenant_id).toBe("fastrak");
  const lines = await q("select tenant_id from drdet where dr_id = $1", [a.id]);
  expect(lines[0]?.tenant_id).toBe("fastrak");
  await db.close();
});

test("updateDR replaces header fields and line items and recomputes totals", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const item = await createItem({ code: "U" }, q);

  const dr = await createDR(
    { dr_no: "OLD", lines: [{ item_id: item.id, qty: 1, qty2: 1, price: "1.00" }] },
    d
  );

  const updated = await updateDR(
    dr.id,
    {
      dr_no: "NEW",
      add_pct: 10,
      lines: [{ item_id: item.id, qty: 2, qty2: 200, price: "5.00", disc: 0 }]
    },
    d
  );
  expect(updated.dr_no).toBe("NEW");
  expect(updated.lines).toHaveLength(1);
  expect(updated.lines[0]?.qty2).toBe(200);
  // net = 200*5 = 1000 ; add = 100 ; total = 1100
  expect(updated.add_amount).toBe("100.00");
  expect(updated.total).toBe("1100.00");

  // old lines were replaced, not duplicated
  const lines = await q("select count(*)::int as n from drdet where dr_id = $1", [dr.id]);
  expect(lines[0]?.n).toBe(1);
  await db.close();
});

test("createDR stores a blank dr_no as null", async () => {
  const db = await createTestDb();
  const d = asDb(db);
  const dr = await createDR({ dr_no: "   " }, d);
  expect(dr.dr_no).toBeNull();
  await db.close();
});

// ---------------------------------------------------------------------------
// Posting + cancelling (inventory OUT, money-critical)
// ---------------------------------------------------------------------------

test("postDR releases stock OUT per line using qty2 (pieces), marks posted", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const widget = await createItem({ code: "WIDGET" }, q);
  const gadget = await createItem({ code: "GADGET" }, q);

  // seed stock so we can watch it fall
  const { recordMovement } = await import("./inventory");
  await recordMovement({ itemId: widget.id, in: 1000 }, q);
  await recordMovement({ itemId: gadget.id, in: 1000 }, q);
  expect(await currentStock(widget.id, q)).toBe(1000);

  const dr = await createDR(
    {
      dr_no: "POST-1",
      dr_date: "2024-03-10",
      lines: [
        { item_id: widget.id, qty: 5, qty2: 240, price: "20.00" },
        { item_id: gadget.id, qty: 2, qty2: 48, price: "8.50" }
      ]
    },
    d
  );

  const posted = await postDR(dr.id, d);
  expect(posted.posted).toBe(true);

  // stock fell by qty2 (pieces), not qty (boxes)
  expect(await currentStock(widget.id, q)).toBe(760); // 1000 - 240
  expect(await currentStock(gadget.id, q)).toBe(952); // 1000 - 48

  const moves = await listMovements(q, widget.id);
  const out = moves.find((m) => m.dr_id === dr.id);
  expect(out?.qty_out).toBe(240);
  expect(out?.qty_in).toBe(0);
  expect(out?.movement_date).toBe("2024-03-10");
  await db.close();
});

test("postDR is idempotent — posting twice does not double the OUT", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const item = await createItem({ code: "ONCE" }, q);
  const { recordMovement } = await import("./inventory");
  await recordMovement({ itemId: item.id, in: 100 }, q);

  const dr = await createDR(
    { dr_no: "IDEM", lines: [{ item_id: item.id, qty: 1, qty2: 25, price: "1.00" }] },
    d
  );
  await postDR(dr.id, d);
  expect(await currentStock(item.id, q)).toBe(75);
  await postDR(dr.id, d);
  expect(await currentStock(item.id, q)).toBe(75);
  await db.close();
});

test("cancelDR reverses a posted DR's stock and marks cancelled", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const item = await createItem({ code: "REV" }, q);
  const { recordMovement } = await import("./inventory");
  await recordMovement({ itemId: item.id, in: 100 }, q);

  const dr = await createDR(
    { dr_no: "CAN", lines: [{ item_id: item.id, qty: 1, qty2: 30, price: "1.00" }] },
    d
  );
  await postDR(dr.id, d);
  expect(await currentStock(item.id, q)).toBe(70);

  const cancelled = await cancelDR(dr.id, d);
  expect(cancelled.cancelled).toBe(true);
  expect(cancelled.posted).toBe(false);
  // the OUT was reversed by an offsetting IN -> stock back to 100
  expect(await currentStock(item.id, q)).toBe(100);
  await db.close();
});

test("cancelDR on an unposted DR just marks it cancelled (no movements)", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const item = await createItem({ code: "X" }, q);

  const dr = await createDR(
    { dr_no: "U", lines: [{ item_id: item.id, qty: 1, qty2: 5, price: "1.00" }] },
    d
  );
  const cancelled = await cancelDR(dr.id, d);
  expect(cancelled.cancelled).toBe(true);
  const moves = await listMovements(q, item.id);
  expect(moves).toHaveLength(0);
  await db.close();
});

test("postDR throws for a cancelled DR", async () => {
  const db = await createTestDb();
  const d = asDb(db);
  const dr = await createDR({ dr_no: "C" }, d);
  await cancelDR(dr.id, d);
  await expect(postDR(dr.id, d)).rejects.toThrow();
  await db.close();
});

// ---------------------------------------------------------------------------
// Atomicity / rollback — multi-step writes are all-or-nothing (issue: fix #1)
// ---------------------------------------------------------------------------

// A Db that runs a real PGlite transaction but throws after the Nth inventory
// insert inside it — to prove postDR posts all OUT movements + the flag flip as
// one unit (a failure partway leaves NOTHING committed).
function failingAfter(
  db: Awaited<ReturnType<typeof createTestDb>>,
  failOnInsertNumber: number
): import("./db").Db {
  let inserts = 0;
  return {
    query: (text, params) =>
      db.query(text, params).then((r) => r.rows as Record<string, unknown>[]),
    transaction: (fn) =>
      db.transaction(async (tx) => {
        const exec = (text: string, params?: unknown[]) => {
          if (/insert into inventory/i.test(text)) {
            inserts += 1;
            if (inserts === failOnInsertNumber) {
              throw new Error("injected failure mid-transaction");
            }
          }
          return tx
            .query(text, params)
            .then((r) => r.rows as Record<string, unknown>[]);
        };
        return fn(exec);
      })
  };
}

test("createDR rolls back the header AND all lines when a later line fails", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const good = await createItem({ code: "GOOD" }, q);

  // The second line references a non-existent item -> drdet's item_id FK fails
  // partway. The whole createDR must roll back: no dr header, no drdet rows.
  await expect(
    createDR(
      {
        dr_no: "ROLLBACK",
        lines: [
          { item_id: good.id, qty: 1, qty2: 10, price: "1.00" },
          { item_id: "NOSUCHITEM", qty: 1, qty2: 5, price: "2.00" }
        ]
      },
      d
    )
  ).rejects.toThrow();

  const headers = await q("select count(*)::int as n from dr");
  expect((headers[0] as { n: number }).n).toBe(0);
  const lines = await q("select count(*)::int as n from drdet");
  expect((lines[0] as { n: number }).n).toBe(0);
  await db.close();
});

test("postDR rolls back all OUT movements when posting fails partway, and a retry does not double-release stock", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const widget = await createItem({ code: "WIDGET" }, q);
  const gadget = await createItem({ code: "GADGET" }, q);
  const { recordMovement } = await import("./inventory");
  await recordMovement({ itemId: widget.id, in: 1000 }, q);
  await recordMovement({ itemId: gadget.id, in: 1000 }, q);

  const dr = await createDR(
    {
      dr_no: "POST-FAIL",
      dr_date: "2024-03-10",
      lines: [
        { item_id: widget.id, qty: 5, qty2: 240, price: "20.00" },
        { item_id: gadget.id, qty: 2, qty2: 48, price: "8.50" }
      ]
    },
    d
  );

  // Fail on the SECOND inventory insert: the first OUT (widget) is written, then
  // the transaction throws. It must all roll back — no movements written by the
  // post, posted still false — so re-clicking Post cannot double-release stock.
  const poison = failingAfter(db, 2);
  await expect(postDR(dr.id, poison)).rejects.toThrow();

  expect(await currentStock(widget.id, q)).toBe(1000);
  expect(await currentStock(gadget.id, q)).toBe(1000);
  // only the two seed IN movements exist; the post wrote no OUT movement
  expect(await listMovements(q)).toHaveLength(2);
  const reread = await getDR(dr.id, q);
  expect(reread?.posted).toBe(false);

  // Retry through a healthy Db: stock falls exactly once.
  await postDR(dr.id, d);
  expect(await currentStock(widget.id, q)).toBe(760); // 1000 - 240
  expect(await currentStock(gadget.id, q)).toBe(952); // 1000 - 48

  // a second post is still a no-op (idempotent on top of atomic)
  await postDR(dr.id, d);
  expect(await currentStock(widget.id, q)).toBe(760);
  expect(await currentStock(gadget.id, q)).toBe(952);
  await db.close();
});

// ---------------------------------------------------------------------------
// FIDELITY tests — load fastrak's ACTUAL dr/drdet sample rows and assert our
// computed totals match fastrak's stored values. YADD is the one computed money
// value fastrak persists, so it is the cross-check anchor.
// ---------------------------------------------------------------------------

type DrRow = {
  CID: string;
  CDRNO: string;
  NDRDISC: number | null;
  NDRDISC2: number | null;
  NADD: number | null;
  YADD: number | null;
};
type DetRow = {
  CDRID: string;
  YPRICE: number | null;
  NQTY2: number | null;
  NDISC: number | null;
  NDISC2: number | null;
};

function loadFastrak() {
  const dr = readDbf(path.join(DATA, "dr.dbf")).records as unknown as DrRow[];
  const det = readDbf(path.join(DATA, "drdet.dbf")).records as unknown as DetRow[];
  return { dr, det };
}

function linesFor(det: DetRow[], drId: string): DRLineInput[] {
  return det
    .filter((d) => d.CDRID === drId)
    .map((d) => ({
      qty2: d.NQTY2 ?? 0,
      // Y currency decoded to a number -> exact string for the numeric column
      price: d.YPRICE == null ? null : Number(d.YPRICE).toFixed(2),
      disc: d.NDISC ?? 0,
      disc2: d.NDISC2 ?? 0
    }));
}

test("fidelity: every fastrak DR's computed add-on (YADD) matches the stored value", () => {
  const { dr, det } = loadFastrak();
  expect(dr.length).toBeGreaterThan(0);
  for (const h of dr) {
    const totals = computeDRTotals(
      { doc_disc: h.NDRDISC ?? 0, add_pct: h.NADD ?? 0 },
      linesFor(det, h.CID)
    );
    const storedYadd = Number(h.YADD ?? 0).toFixed(2);
    expect(
      totals.add_amount,
      `DR ${h.CDRNO.trim()} (${h.CID.trim()}) add-on`
    ).toBe(storedYadd);
  }
});

test("fidelity: known fastrak DR totals reproduce exactly", () => {
  const { dr, det } = loadFastrak();
  const by = (no: string) => dr.find((d) => d.CDRNO.trim() === no)!;

  // DR 1984 (CID 1985): net 6698.00, NADD 5% -> 334.90, NDRDISC 3% -> 200.94,
  // grand = (6698 + 334.90) - 200.94 = 6831.96
  const a = by("1984");
  const ta = computeDRTotals(
    { doc_disc: a.NDRDISC ?? 0, add_pct: a.NADD ?? 0 },
    linesFor(det, a.CID)
  );
  expect(ta.net).toBe("6698.00");
  expect(ta.add_amount).toBe("334.90");
  expect(ta.doc_disc_amount).toBe("200.94");
  expect(ta.total).toBe("6831.96");

  // DR 1985 (CID 1986): net 3776.00, NADD 10% -> 377.60, NDRDISC 0 -> 0,
  // grand = 3776 + 377.60 = 4153.60
  const b = by("1985");
  const tb = computeDRTotals(
    { doc_disc: b.NDRDISC ?? 0, add_pct: b.NADD ?? 0 },
    linesFor(det, b.CID)
  );
  expect(tb.net).toBe("3776.00");
  expect(tb.add_amount).toBe("377.60");
  expect(tb.total).toBe("4153.60");

  // DR 1983 (CID 1984): net 21202.50, NADD 0, NDRDISC 5% -> 1060.13,
  // grand = 21202.50 - 1060.13 = 20142.37
  const c = by("1983");
  const tc = computeDRTotals(
    { doc_disc: c.NDRDISC ?? 0, add_pct: c.NADD ?? 0 },
    linesFor(det, c.CID)
  );
  expect(tc.net).toBe("21202.50");
  expect(tc.doc_disc_amount).toBe("1060.13");
  expect(tc.total).toBe("20142.37");
});
