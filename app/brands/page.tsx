import { listBrands, type Brand } from "@/lib/brands";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  let brands: Brand[] = [];
  let error: string | null = null;
  try {
    brands = await listBrands();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main>
      <div className="crumb">
        <a href="/">← fastrak</a> / brands
      </div>
      <div className="kicker">fastrak reference data</div>
      <h1>Brands</h1>

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
            <span className="count">{brands.length} brand(s)</span>
            <span className="tag">source: brand.dbf</span>
            <a href="/brands/new" className="tag">
              + new brand
            </a>
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Brand</th>
                  <th>Remarks</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {brands.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      No brands yet — run <code>npm run db:import</code> or add one.
                    </td>
                  </tr>
                ) : (
                  brands.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{b.id}</td>
                      <td>{b.brand ?? "—"}</td>
                      <td>{b.remarks ?? "—"}</td>
                      <td>
                        <a href={`/brands/${b.id}`}>edit</a>
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
