// S5 Delivery Receipts — the landing screen. Lists every DR header (number, date,
// customer, status). Server component, mirrors the dark style of app/po + app/items.
import { listDRs, type DRHeader } from "@/lib/dr";
import { listCustomers, type Customer } from "@/lib/customers";

export const dynamic = "force-dynamic";

// A DR that has been saved but not yet posted is a Draft (ADR-0006): editable,
// possibly incomplete, with no effect on stock/A.R. Show it with a clear Draft badge.
function statusOf(dr: DRHeader): { label: string; color: string } {
  if (dr.cancelled) return { label: "cancelled", color: "#f0a3a3" };
  if (dr.posted) return { label: "posted", color: "var(--green)" };
  return { label: "Draft", color: "var(--amber)" };
}

export default async function DRPage() {
  let drs: DRHeader[] = [];
  let customers: Customer[] = [];
  let error: string | null = null;
  try {
    [drs, customers] = await Promise.all([listDRs(), listCustomers()]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const customerName = new Map(customers.map((c) => [c.id, c.name ?? c.id]));

  return (
    <main>
      <div className="crumb">
        <a href="/">← fastrak</a> / delivery receipts
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Delivery Receipts</h1>

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
            <span className="count">{drs.length} delivery receipt(s)</span>
            <span className="tag">source: dr.dbf</span>
            <a href="/dr/new" className="tag">
              + new delivery receipt
            </a>
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>DR no.</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {drs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      No delivery receipts yet — run <code>npm run db:import</code>{" "}
                      or add one.
                    </td>
                  </tr>
                ) : (
                  drs.map((dr) => {
                    const status = statusOf(dr);
                    return (
                      <tr key={dr.id}>
                        <td>{dr.dr_no ?? "—"}</td>
                        <td>{dr.dr_date ?? "—"}</td>
                        <td>
                          {dr.customer_id
                            ? customerName.get(dr.customer_id) ?? dr.customer_id
                            : "—"}
                        </td>
                        <td>
                          <span style={{ color: status.color }}>{status.label}</span>
                        </td>
                        <td>
                          <a href={`/dr/${dr.id}`}>view</a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
