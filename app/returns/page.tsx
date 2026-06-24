// S8 Returns — the landing screen. Lists every return header (date, customer,
// status). A posted return has put resalable goods back into stock and credited the
// customer's A/R. Server component, mirrors the dark style of app/dr + app/ar.
import { listReturns, type ReturnHeader } from "@/lib/returns";
import { listCustomers, type Customer } from "@/lib/customers";

export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  let returns: ReturnHeader[] = [];
  let customers: Customer[] = [];
  let error: string | null = null;
  try {
    [returns, customers] = await Promise.all([listReturns(), listCustomers()]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const customerName = new Map(customers.map((c) => [c.id, c.name ?? c.id]));

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / returns
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Returns</h1>

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
            <span className="count">{returns.length} return(s)</span>
            <span className="tag">source: return.dbf</span>
            <a href="/returns/new" className="tag">
              + new return
            </a>
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {returns.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      No returns yet — run <code>npm run db:import</code> or add one.
                    </td>
                  </tr>
                ) : (
                  returns.map((ret) => (
                    <tr key={ret.id}>
                      <td>{ret.return_date ?? "—"}</td>
                      <td>
                        {ret.customer_id
                          ? customerName.get(ret.customer_id) ?? ret.customer_id
                          : "—"}
                      </td>
                      <td>
                        {/* An unposted return is a Draft (ADR-0006): editable,
                            possibly incomplete, with no effect on stock/A.R. */}
                        <span
                          style={{
                            color: ret.posted ? "var(--green)" : "var(--amber)"
                          }}
                        >
                          {ret.posted ? "posted" : "Draft"}
                        </span>
                      </td>
                      <td>
                        <a href={`/returns/${ret.id}`}>view</a>
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
