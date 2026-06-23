import { listSuppliers, type Supplier } from "@/lib/suppliers";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  let suppliers: Supplier[] = [];
  let error: string | null = null;
  try {
    suppliers = await listSuppliers();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / suppliers
      </div>
      <div className="kicker">fastrak reference data</div>
      <h1>Suppliers</h1>

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
            <span className="count">{suppliers.length} supplier(s)</span>
            <span className="tag">source: supplier.dbf</span>
            <a href="/suppliers/new" className="tag">
              + new supplier
            </a>
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Terms</th>
                  <th>Contact</th>
                  <th>Tel</th>
                  <th>Local</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      No suppliers yet — run <code>npm run db:import</code> or add one.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{s.id}</td>
                      <td>{s.name ?? "—"}</td>
                      <td>{s.terms_days ?? "—"}</td>
                      <td>{s.contact_person ?? "—"}</td>
                      <td>{s.tel_no ?? "—"}</td>
                      <td>{s.is_local == null ? "—" : s.is_local ? "yes" : "no"}</td>
                      <td>
                        <a href={`/suppliers/${s.id}`}>edit</a>
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
