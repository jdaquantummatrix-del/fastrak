// S6 Accounts Receivable — the landing screen. Two panels:
//  1. Per-customer roll-up: outstanding balance + aging buckets (current / 1-30 /
//     31-60 / 61-90 / 90+ days overdue), keyed off each receivable's due date.
//  2. The open receivables ledger (one row per posted DR), newest due first.
// A/R rows are RAISED by posting a DR (lib/dr.ts postDR) — there is no "new A/R"
// action here. Server component, mirrors the dark style of app/inventory + app/dr.
import {
  listAR,
  summarizeByCustomer,
  type ARRow,
  type CustomerBalance
} from "@/lib/ar";
import { listCustomers, type Customer } from "@/lib/customers";

export const dynamic = "force-dynamic";

// Money as a grouped string (e.g. "1,234.50"); a blank/zero shows as a muted dash.
function peso(v: string | null | undefined): string {
  const n = Number(v ?? 0);
  if (!n) return "—";
  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export default async function ARPage() {
  let rows: ARRow[] = [];
  let summary: CustomerBalance[] = [];
  let customers: Customer[] = [];
  let error: string | null = null;
  try {
    [rows, summary, customers] = await Promise.all([
      listAR(),
      summarizeByCustomer(),
      listCustomers()
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const customerName = new Map(customers.map((c) => [c.id, c.name ?? c.id]));
  const total = summary.reduce((s, r) => s + Number(r.balance), 0);
  const today = new Date().toISOString().slice(0, 10);

  // Is this receivable overdue as of today? (drives the due-date highlight)
  const overdue = (due: string | null) => due != null && due < today;

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / accounts receivable
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Accounts Receivable</h1>

      {error ? (
        <div className="card" style={{ padding: "18px 20px" }}>
          <strong style={{ color: "#f0a3a3" }}>Database not reachable.</strong>
          <p className="muted" style={{ marginBottom: 6 }}>
            Start it and load the data with: <code>npm run db:setup</code>
          </p>
          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
            ({error})
          </p>
        </div>
      ) : (
        <>
          <div className="badge-row">
            <span className="count">{summary.length} customer(s) owing</span>
            <span className="tag">{rows.length} open receivable(s)</span>
            <span className="tag">outstanding: {peso(total.toFixed(2))}</span>
            <span className="tag">source: ar.dbf (raised on DR post)</span>
          </div>

          <h2 style={{ fontSize: 18, marginTop: 24 }}>Balance by customer</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th style={{ textAlign: "right" }}>Current</th>
                  <th style={{ textAlign: "right" }}>1–30</th>
                  <th style={{ textAlign: "right" }}>31–60</th>
                  <th style={{ textAlign: "right" }}>61–90</th>
                  <th style={{ textAlign: "right" }}>90+</th>
                  <th style={{ textAlign: "right" }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {summary.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      No receivables yet — post a delivery receipt to raise one.
                    </td>
                  </tr>
                ) : (
                  summary.map((r) => (
                    <tr key={r.customer_id ?? "—"}>
                      <td>
                        {r.customer_name ??
                          (r.customer_id
                            ? customerName.get(r.customer_id) ?? r.customer_id
                            : "—")}
                      </td>
                      <td style={{ textAlign: "right" }}>{peso(r.current)}</td>
                      <td style={{ textAlign: "right" }}>{peso(r.d1_30)}</td>
                      <td style={{ textAlign: "right" }}>{peso(r.d31_60)}</td>
                      <td style={{ textAlign: "right" }}>{peso(r.d61_90)}</td>
                      <td
                        style={{
                          textAlign: "right",
                          color: Number(r.d90_plus) ? "#f0a3a3" : undefined
                        }}
                      >
                        {peso(r.d90_plus)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {peso(r.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: 18, marginTop: 28 }}>Open receivables</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>DR no.</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Due</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      No receivables yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.dr_no ?? "—"}</td>
                      <td>
                        {r.customer_id
                          ? customerName.get(r.customer_id) ?? r.customer_id
                          : "—"}
                      </td>
                      <td>{r.ar_date ?? "—"}</td>
                      <td
                        style={{
                          color: overdue(r.due_date) ? "#f0a3a3" : undefined,
                          fontWeight: overdue(r.due_date) ? 600 : undefined
                        }}
                      >
                        {r.due_date ?? "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>{peso(r.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
