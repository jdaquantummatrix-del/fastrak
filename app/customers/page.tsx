import { listCustomers, type Customer } from "@/lib/customers";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  let customers: Customer[] = [];
  let error: string | null = null;
  try {
    customers = await listCustomers();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main>
      <div className="crumb">
        <a href="/">← fastrak</a> / customers
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Customers</h1>

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
            <span className="count">{customers.length} customer(s)</span>
            <span className="tag">source: customer.dbf</span>
            <a href="/customers/new" className="tag">
              + new customer
            </a>
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Terms</th>
                  <th>Mobile</th>
                  <th>Tel</th>
                  <th>Address</th>
                  <th>TIN</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="muted">
                      No customers yet — run <code>npm run db:import</code> or add one.
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{c.id}</td>
                      <td>{c.name ?? "—"}</td>
                      <td>{c.type ?? "—"}</td>
                      <td>{c.terms_days ?? "—"}</td>
                      <td>{c.mobile ?? "—"}</td>
                      <td>{c.tel_no ?? "—"}</td>
                      <td>{c.address ?? "—"}</td>
                      <td>{c.tin ?? "—"}</td>
                      <td>
                        <a href={`/customers/${c.id}`}>edit</a>
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
