// S11 — Documents / Reports (base templates, ADR-0003). Pure data-assembly
// helpers shared by the printable report pages (app/dr/[id]/print,
// app/reports/ar, app/reports/inventory). These do NOT touch the database — the
// pages call the owning modules (lib/dr, lib/ar, lib/inventory) for the rows and
// pass them here for presentation-shaping (money formatting, per-line amounts,
// aging/stock roll-ups, low-stock filtering).
//
// Money everywhere is the exact numeric(14,2) *string* the data modules return
// (e.g. "1234.50"); we never round or re-derive currency here — we only format
// it for display and sum already-rounded column figures. Summation is done in
// integer centavos so the displayed totals stay exact (no binary-float drift),
// matching the ADR-0001 fidelity rule the lib modules follow.
import type { ItemStock } from "./inventory";
import type { CustomerBalance, Aging } from "./ar";

// Format an exact money string/number as a grouped 2-decimal string for a
// printout (e.g. "1234.5" -> "1,234.50"). `dashZero` shows a blank/zero as an
// em-dash (used in tables); off, it shows "0.00" (used in totals rows).
export function formatMoney(
  v: string | number | null | undefined,
  opts: { dashZero?: boolean } = {}
): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return opts.dashZero ? "—" : "0.00";
  if (n === 0 && opts.dashZero) return "—";
  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Sum a list of exact 2-decimal money strings into one exact 2-decimal string.
// Works in integer centavos so the result never drifts off a binary float.
export function sumMoney(values: Array<string | number | null | undefined>): string {
  let cents = 0;
  for (const v of values) {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n)) continue;
    cents += Math.round(n * 100);
  }
  return (cents / 100).toFixed(2);
}

// The priced amount fastrak prints for ONE Delivery Receipt line: the line's
// piece quantity (qty2) times its unit price, with its two line discounts
// compounded — identical to the per-line figure computeDRTotals sums into `net`
// (lib/dr.ts getdiscount). Returns an exact 2-decimal string. A line with no
// price returns null (the no-price variant hides the column anyway).
export function drLineAmount(line: {
  price: string | null;
  qty2: number;
  disc: string | null;
  disc2: string | null;
}): string | null {
  if (line.price == null) return null;
  const price = Number(line.price);
  const d1 = Number(line.disc ?? 0);
  const d2 = Number(line.disc2 ?? 0);
  // round half away from zero to 2dp, in integer centavos (matches lib/dr round2)
  const raw = price * line.qty2 * ((100 - d1) / 100) * ((100 - d2) / 100);
  const cents = raw * 100;
  const sign = cents < 0 ? -1 : 1;
  const rounded = Math.floor(Math.abs(cents) + 0.5 + 1e-9);
  return ((sign * rounded) / 100).toFixed(2);
}

// A stock report row: an ItemStock plus whether it is at/below its critical
// (reorder) threshold. `low` drives the critical-stock highlight and the
// critical-stock report's filter.
export type StockReportRow = ItemStock & { low: boolean };

// Is this item at or below its critical (reorder) threshold? An item with no
// threshold set is never "low" (mirrors app/inventory's `low` check).
export function isLowStock(s: Pick<ItemStock, "critical" | "stock">): boolean {
  return s.critical != null && s.stock <= s.critical;
}

// Shape stockByItem rows for the inventory report: tag each with `low` and,
// when `criticalOnly`, keep only the low-stock rows (the critical-stock variant).
export function buildStockReport(
  rows: ItemStock[],
  opts: { criticalOnly?: boolean } = {}
): StockReportRow[] {
  const tagged = rows.map((s) => ({ ...s, low: isLowStock(s) }));
  return opts.criticalOnly ? tagged.filter((r) => r.low) : tagged;
}

// The column totals across every customer on an A/R statement: one summed,
// exact 2-decimal figure per aging bucket plus the grand outstanding balance.
// Footer of the A/R statement report.
export type AgingTotals = Aging & { balance: string };

export function agingTotals(rows: CustomerBalance[]): AgingTotals {
  return {
    current: sumMoney(rows.map((r) => r.current)),
    d1_30: sumMoney(rows.map((r) => r.d1_30)),
    d31_60: sumMoney(rows.map((r) => r.d31_60)),
    d61_90: sumMoney(rows.map((r) => r.d61_90)),
    d90_plus: sumMoney(rows.map((r) => r.d90_plus)),
    balance: sumMoney(rows.map((r) => r.balance))
  };
}
