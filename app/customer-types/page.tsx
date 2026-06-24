import { listCustomerTypes, type CustomerType } from "@/lib/customer-types";

export const dynamic = "force-dynamic";

export default async function CustomerTypesPage() {
  let types: CustomerType[] = [];
  let error: string | null = null;
  try {
    types = await listCustomerTypes();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main>
      <div className="crumb">
        <a href="/">← fastrak</a> / customer types
      </div>
      <div className="kicker">fastrak reference data</div>
      <h1>Customer Types</h1>

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
            <span className="count">{types.length} type(s)</span>
            <span className="tag">customer classification</span>
            <a href="/customer-types/new" className="tag">
              + new type
            </a>
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Remarks</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {types.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      No customer types yet — add one.
                    </td>
                  </tr>
                ) : (
                  types.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{t.id}</td>
                      <td>{t.name ?? "—"}</td>
                      <td>{t.remarks ?? "—"}</td>
                      <td>
                        <a href={`/customer-types/${t.id}`}>edit</a>
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
