// S11 — Inventory / stock report (ADR-0003). The printable current-stock listing:
// one row per item with movements, its on-hand balance and critical (reorder)
// threshold. Reads lib/inventory.stockByItem (the same per-item roll-up the
// inventory landing screen uses) and the owning lib/company for the header;
// shapes rows with lib/reports.buildStockReport. A query param switches to the
// critical-stock variant (same template, ADR-0003 "variants are options"):
//   /reports/inventory              -> full stock listing
//   /reports/inventory?critical=1   -> only items at/below their critical level
// Server component in the shared print layout.
import { stockByItem, type ItemStock } from "@/lib/inventory";
import { getCompany } from "@/lib/company";
import { PrintLayout } from "../print-layout";
import { buildStockReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function InventoryReportPage({
  searchParams
}: {
  searchParams: Promise<{ critical?: string }>;
}) {
  const { critical } = await searchParams;
  const criticalOnly = ["1", "yes", "true", "only"].includes(
    (critical ?? "").toLowerCase()
  );

  let stock: ItemStock[] = [];
  let company = null;
  let error: string | null = null;
  try {
    [stock, company] = await Promise.all([stockByItem(), getCompany()]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const rows = buildStockReport(stock, { criticalOnly });

  return (
    <PrintLayout
      company={company}
      title={criticalOnly ? "Critical Stock Report" : "Inventory Stock Report"}
      subtitle={`As of ${new Date().toISOString().slice(0, 10)} • ${rows.length} item(s)`}
      backHref="/inventory"
    >
      {error ? (
        <p className="empty">Database not reachable ({error}).</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: 110 }}>Code</th>
              <th>Description</th>
              <th>Unit</th>
              <th className="num">On hand</th>
              <th className="num">Critical</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty">
                  {criticalOnly
                    ? "No items are at or below their critical level."
                    : "No stock movements yet."}
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.item_id}>
                  <td>{s.code ?? "—"}</td>
                  <td>{s.description ?? "—"}</td>
                  <td>{s.unit ?? "—"}</td>
                  <td className={s.low ? "num low" : "num"}>{s.stock}</td>
                  <td className="num">{s.critical ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </PrintLayout>
  );
}
