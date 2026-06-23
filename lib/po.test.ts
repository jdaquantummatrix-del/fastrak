import { test, expect } from "vitest";
import { createTestDb, asDb } from "./test-db";
import { createPO, listPOs, getPO, receivePO } from "./po";
import { createItem } from "./items";
import { createSupplier } from "./suppliers";
import { currentStock, listMovements } from "./inventory";

// A PGlite-backed executor matching the lib/db.ts `query` shape — for reads and
// the read-only helpers. Transactional functions (createPO/receivePO) take a Db
// instead, built from the same PGlite via asDb.
function executor(db: Awaited<ReturnType<typeof createTestDb>>) {
  return (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);
}

test("createPO stores the header and its line items", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const supplier = await createSupplier({ name: "Acme Supply" }, q);
  const widget = await createItem({ code: "WIDGET", description: "Widget" }, q);
  const gadget = await createItem({ code: "GADGET", description: "Gadget" }, q);

  const po = await createPO(
    {
      po_no: "PO-001",
      po_date: "2024-02-01",
      supplier_id: supplier.id,
      remarks: "rush",
      lines: [
        { item_id: widget.id, qty: 100, base_cost: "12.50", unit: "BOX" },
        { item_id: gadget.id, qty: 50, base_cost: "5.00", unit: "PCS" }
      ]
    },
    d
  );

  expect(po.id).toHaveLength(10);
  expect(po.po_no).toBe("PO-001");
  expect(po.po_date).toBe("2024-02-01");
  expect(po.supplier_id).toBe(supplier.id);
  expect(po.received).toBe(false);
  expect(po.lines).toHaveLength(2);
  // money round-trips as an exact decimal string (no float drift)
  expect(po.lines[0]?.base_cost).toBe("12.50");
  expect(po.lines[0]?.qty).toBe(100);
  expect(po.lines[0]?.item_id).toBe(widget.id);
  expect(po.lines[1]?.qty).toBe(50);
  await db.close();
});

test("listPOs returns each header (without lines) and getPO returns lines", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const item = await createItem({ code: "A" }, q);

  const created = await createPO(
    { po_no: "PO-9", lines: [{ item_id: item.id, qty: 3, base_cost: "1.00" }] },
    d
  );

  const list = await listPOs(q);
  expect(list).toHaveLength(1);
  expect(list[0]?.id).toBe(created.id);
  expect(list[0]?.po_no).toBe("PO-9");

  const fetched = await getPO(created.id, q);
  expect(fetched?.id).toBe(created.id);
  expect(fetched?.lines).toHaveLength(1);
  expect(fetched?.lines[0]?.qty).toBe(3);
  await db.close();
});

test("getPO returns null for an unknown id", async () => {
  const db = await createTestDb();
  const q = executor(db);
  expect(await getPO("NOPE000000", q)).toBeNull();
  await db.close();
});

test("createPO generates a unique 10-char id and tags tenant fastrak", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const item = await createItem({ code: "T" }, q);

  const a = await createPO(
    { po_no: "X", lines: [{ item_id: item.id, qty: 1, base_cost: "1.00" }] },
    d
  );
  const b = await createPO(
    { po_no: "Y", lines: [{ item_id: item.id, qty: 1, base_cost: "1.00" }] },
    d
  );
  expect(a.id).not.toBe(b.id);
  expect(a.id).toHaveLength(10);

  const rows = await q("select tenant_id from po where id = $1", [a.id]);
  expect(rows[0]?.tenant_id).toBe("fastrak");
  // detail lines are tenant-tagged too
  const lineRows = await q("select tenant_id from podet where po_id = $1", [a.id]);
  expect(lineRows[0]?.tenant_id).toBe("fastrak");
  await db.close();
});

test("createPO with no lines stores an empty header", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const po = await createPO({ po_no: "EMPTY" }, d);
  expect(po.lines).toHaveLength(0);
  const fetched = await getPO(po.id, q);
  expect(fetched?.lines).toHaveLength(0);
  await db.close();
});

test("receivePO adds an inventory IN movement per line, increasing item stock", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const widget = await createItem({ code: "WIDGET" }, q);
  const gadget = await createItem({ code: "GADGET" }, q);

  expect(await currentStock(widget.id, q)).toBe(0);
  expect(await currentStock(gadget.id, q)).toBe(0);

  const po = await createPO(
    {
      po_no: "RCV-1",
      po_date: "2024-03-10",
      lines: [
        { item_id: widget.id, qty: 100, base_cost: "1.00" },
        { item_id: gadget.id, qty: 40, base_cost: "2.00" }
      ]
    },
    d
  );

  const received = await receivePO(po.id, d);
  expect(received.received).toBe(true);

  // stock rose by the ordered quantities
  expect(await currentStock(widget.id, q)).toBe(100);
  expect(await currentStock(gadget.id, q)).toBe(40);

  // the movements are IN movements tagged to this PO
  const widgetMoves = await listMovements(q, widget.id);
  expect(widgetMoves).toHaveLength(1);
  expect(widgetMoves[0]?.qty_in).toBe(100);
  expect(widgetMoves[0]?.qty_out).toBe(0);
  expect(widgetMoves[0]?.po_id).toBe(po.id);
  expect(widgetMoves[0]?.movement_date).toBe("2024-03-10");
  await db.close();
});

test("receivePO is idempotent — receiving twice does not double the stock", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const item = await createItem({ code: "ONCE" }, q);

  const po = await createPO(
    { po_no: "IDEM", lines: [{ item_id: item.id, qty: 25, base_cost: "1.00" }] },
    d
  );

  await receivePO(po.id, d);
  expect(await currentStock(item.id, q)).toBe(25);

  // a second receive is a no-op (already received)
  await receivePO(po.id, d);
  expect(await currentStock(item.id, q)).toBe(25);
  const moves = await listMovements(q, item.id);
  expect(moves).toHaveLength(1);
  await db.close();
});

test("receivePO throws for an unknown PO id", async () => {
  const db = await createTestDb();
  const d = asDb(db);
  await expect(receivePO("NOPE000000", d)).rejects.toThrow();
  await db.close();
});

test("createPO stores a blank po_no as null", async () => {
  const db = await createTestDb();
  const d = asDb(db);
  const po = await createPO({ po_no: "   " }, d);
  expect(po.po_no).toBeNull();
  await db.close();
});

test("getPO line_total is base_cost*qty as an exact decimal string (no float drift)", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const a = await createItem({ code: "A" }, q);
  const b = await createItem({ code: "B" }, q);

  const po = await createPO(
    {
      po_no: "TOTALS",
      lines: [
        { item_id: a.id, qty: 100, base_cost: "12.50" }, // 1250.00
        { item_id: b.id, qty: 3, base_cost: "0.10" } // 0.30 (JS 0.1*3 = 0.30000000000000004)
      ]
    },
    d
  );

  // computed on insert (returning) ...
  expect(po.lines[0]?.line_total).toBe("1250.00");
  expect(po.lines[1]?.line_total).toBe("0.30");

  // ... and on read
  const fetched = await getPO(po.id, q);
  const totals = fetched?.lines.map((l) => l.line_total);
  expect(totals).toContain("1250.00");
  expect(totals).toContain("0.30");
  await db.close();
});

// ---------------------------------------------------------------------------
// Atomicity / rollback — multi-step writes are all-or-nothing (issue: fix #1)
// ---------------------------------------------------------------------------

test("createPO rolls back the header AND all lines when a later line fails", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const good = await createItem({ code: "GOOD" }, q);

  // The second line references an item that doesn't exist -> podet's item_id FK
  // fails partway through. The whole createPO must roll back: no po header, no
  // podet rows at all (not even the first, valid line).
  await expect(
    createPO(
      {
        po_no: "ROLLBACK",
        lines: [
          { item_id: good.id, qty: 10, base_cost: "1.00" },
          { item_id: "NOSUCHITEM", qty: 5, base_cost: "2.00" }
        ]
      },
      d
    )
  ).rejects.toThrow();

  const headers = await q("select count(*)::int as n from po");
  expect((headers[0] as { n: number }).n).toBe(0);
  const lines = await q("select count(*)::int as n from podet");
  expect((lines[0] as { n: number }).n).toBe(0);
  await db.close();
});

// A Db that runs a real PGlite transaction but injects a thrown error after the
// Nth write inside it — to prove receivePO posts all movements + the flag flip as
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

test("receivePO rolls back all movements when posting fails partway, and a retry does not double stock", async () => {
  const db = await createTestDb();
  const q = executor(db);
  const d = asDb(db);
  const widget = await createItem({ code: "WIDGET" }, q);
  const gadget = await createItem({ code: "GADGET" }, q);

  const po = await createPO(
    {
      po_no: "RCV-FAIL",
      po_date: "2024-03-10",
      lines: [
        { item_id: widget.id, qty: 100, base_cost: "1.00" },
        { item_id: gadget.id, qty: 40, base_cost: "2.00" }
      ]
    },
    d
  );

  // Fail on the SECOND inventory insert: the first movement (widget) is written,
  // then the transaction throws. It must all roll back — no movements at all and
  // received still false — so re-clicking Receive cannot double-count stock.
  const poison = failingAfter(db, 2);
  await expect(receivePO(po.id, poison)).rejects.toThrow();

  expect(await currentStock(widget.id, q)).toBe(0);
  expect(await currentStock(gadget.id, q)).toBe(0);
  expect(await listMovements(q)).toHaveLength(0);
  const reread = await getPO(po.id, q);
  expect(reread?.received).toBe(false);

  // Retry through a healthy Db: stock rises exactly once (no double-count).
  await receivePO(po.id, d);
  expect(await currentStock(widget.id, q)).toBe(100);
  expect(await currentStock(gadget.id, q)).toBe(40);

  // a second receive is still a no-op (idempotent on top of atomic)
  await receivePO(po.id, d);
  expect(await currentStock(widget.id, q)).toBe(100);
  expect(await currentStock(gadget.id, q)).toBe(40);
  await db.close();
});
