import { listUnits, type Unit } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function UnitsPage() {
  let units: Unit[] = [];
  let error: string | null = null;
  try {
    units = await listUnits();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main>
      <div className="crumb">
        <a href="/">← fastrak</a> / units
      </div>
      <div className="kicker">fastrak reference data</div>
      <h1>Units</h1>

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
            <span className="count">{units.length} unit(s)</span>
            <span className="tag">source: unit.dbf</span>
            <a href="/units/new" className="tag">
              + new unit
            </a>
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Unit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {units.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      No units yet — run <code>npm run db:import</code> or add one.
                    </td>
                  </tr>
                ) : (
                  units.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{u.id}</td>
                      <td>{u.unit ?? "—"}</td>
                      <td>
                        <a href={`/units/${u.id}`}>edit</a>
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
