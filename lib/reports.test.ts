import { test, expect } from "vitest";
import {
  formatMoney,
  sumMoney,
  drLineAmount,
  isLowStock,
  buildStockReport,
  agingTotals
} from "./reports";
import type { ItemStock } from "./inventory";
import type { CustomerBalance } from "./ar";

// ---- formatMoney ----

test("formatMoney groups thousands and pads to 2 decimals", () => {
  expect(formatMoney("1234.5")).toBe("1,234.50");
  expect(formatMoney(1000000)).toBe("1,000,000.00");
});

test("formatMoney shows zero/blank as 0.00 by default, dash when asked", () => {
  expect(formatMoney(null)).toBe("0.00");
  expect(formatMoney("0.00")).toBe("0.00");
  expect(formatMoney(null, { dashZero: true })).toBe("—");
  expect(formatMoney("0.00", { dashZero: true })).toBe("—");
  // a non-zero value still formats even with dashZero on
  expect(formatMoney("5.00", { dashZero: true })).toBe("5.00");
});

// ---- sumMoney (exact, no float drift) ----

test("sumMoney adds exact 2-decimal strings without binary-float drift", () => {
  // 0.1 + 0.2 famously != 0.3 in float; centavo summation keeps it exact
  expect(sumMoney(["0.10", "0.20"])).toBe("0.30");
  expect(sumMoney(["100.05", "200.10", "0.85"])).toBe("301.00");
  expect(sumMoney([])).toBe("0.00");
  expect(sumMoney([null, undefined, ""])).toBe("0.00");
});

// ---- drLineAmount (must match lib/dr's per-line net contribution) ----

test("drLineAmount with no discounts is price * qty2", () => {
  expect(drLineAmount({ price: "2.00", qty2: 10, disc: "0", disc2: "0" })).toBe(
    "20.00"
  );
});

test("drLineAmount compounds disc then disc2, rounding to 2dp", () => {
  // round((100*1)*(90/100)*(95/100),2) = 85.50 — same as computeDRTotals net
  expect(
    drLineAmount({ price: "100.00", qty2: 1, disc: "10", disc2: "5" })
  ).toBe("85.50");
});

test("drLineAmount rounds half away from zero", () => {
  // 0.005 * 1 -> round(0.005,2) = 0.01
  expect(drLineAmount({ price: "0.005", qty2: 1, disc: "0", disc2: "0" })).toBe(
    "0.01"
  );
});

test("drLineAmount returns null when the line has no price", () => {
  expect(drLineAmount({ price: null, qty2: 5, disc: "0", disc2: "0" })).toBeNull();
});

// ---- stock report helpers ----

function stock(over: Partial<ItemStock>): ItemStock {
  return {
    item_id: "I1",
    code: "C1",
    description: "Item",
    unit: "PCS",
    critical: null,
    stock: 0,
    ...over
  };
}

test("isLowStock is true only at/below a set critical threshold", () => {
  expect(isLowStock({ stock: 5, critical: 10 })).toBe(true); // below
  expect(isLowStock({ stock: 10, critical: 10 })).toBe(true); // at
  expect(isLowStock({ stock: 11, critical: 10 })).toBe(false); // above
  expect(isLowStock({ stock: 0, critical: null })).toBe(false); // no threshold
});

test("buildStockReport tags low and, when criticalOnly, keeps only low rows", () => {
  const rows = [
    stock({ item_id: "A", stock: 2, critical: 5 }), // low
    stock({ item_id: "B", stock: 50, critical: 5 }), // ok
    stock({ item_id: "C", stock: 0, critical: null }) // no threshold -> not low
  ];

  const all = buildStockReport(rows);
  expect(all).toHaveLength(3);
  expect(all.find((r) => r.item_id === "A")?.low).toBe(true);
  expect(all.find((r) => r.item_id === "B")?.low).toBe(false);

  const critical = buildStockReport(rows, { criticalOnly: true });
  expect(critical.map((r) => r.item_id)).toEqual(["A"]);
});

// ---- agingTotals ----

function bal(over: Partial<CustomerBalance>): CustomerBalance {
  return {
    customer_id: "X",
    customer_name: "X Co",
    open_count: 1,
    balance: "0.00",
    current: "0.00",
    d1_30: "0.00",
    d31_60: "0.00",
    d61_90: "0.00",
    d90_plus: "0.00",
    ...over
  };
}

test("agingTotals sums each bucket and the balance across customers", () => {
  const rows = [
    bal({ current: "100.00", d1_30: "50.00", balance: "150.00" }),
    bal({ current: "25.50", d90_plus: "10.00", balance: "35.50" })
  ];
  const t = agingTotals(rows);
  expect(t.current).toBe("125.50");
  expect(t.d1_30).toBe("50.00");
  expect(t.d90_plus).toBe("10.00");
  expect(t.balance).toBe("185.50");
});

test("agingTotals of no customers is all zeroes", () => {
  const t = agingTotals([]);
  expect(t.balance).toBe("0.00");
  expect(t.current).toBe("0.00");
});
