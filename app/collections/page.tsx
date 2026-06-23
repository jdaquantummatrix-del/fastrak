// S7 Collections — the landing screen. Lists every collection (payment received from
// a customer), newest first, with its date, customer and collected total. Recording a
// collection has reduced the targeted A/R balances by the payment. Server component;
// mirrors the dark style of app/ar + app/returns.
import { listCollections, type CollectionHeader } from "@/lib/collections";
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

export default async function CollectionsPage() {
  let collections: (CollectionHeader & { total: string })[] = [];
  let customers: Customer[] = [];
  let error: string | null = null;
  try {
    [collections, customers] = await Promise.all([
      listCollections(),
      listCustomers()
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const customerName = new Map(customers.map((c) => [c.id, c.name ?? c.id]));
  const total = collections.reduce((s, c) => s + Number(c.total), 0);

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / collections
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Collections</h1>

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
            <span className="count">{collections.length} collection(s)</span>
            <span className="tag">collected: {peso(total.toFixed(2))}</span>
            <span className="tag">source: col.dbf</span>
            <a href="/collections/new" className="tag">
              + new collection
            </a>
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Remarks</th>
                  <th style={{ textAlign: "right" }}>Collected</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {collections.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      No collections yet — run <code>npm run db:import</code> or add
                      one.
                    </td>
                  </tr>
                ) : (
                  collections.map((col) => (
                    <tr key={col.id}>
                      <td>{col.col_date ?? "—"}</td>
                      <td>
                        {col.customer_id
                          ? customerName.get(col.customer_id) ?? col.customer_id
                          : "—"}
                      </td>
                      <td className="muted">{col.remarks ?? "—"}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {peso(col.total)}
                      </td>
                      <td>
                        <a href={`/collections/${col.id}`}>view</a>
                      </td>
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
