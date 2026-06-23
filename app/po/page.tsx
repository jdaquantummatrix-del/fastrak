// S9 Purchase Orders — the landing screen. Lists every PO header (number, date,
// supplier, received status). Server component, mirrors the dark style of
// app/inventory + app/items.
import { listPOs, type POHeader } from "@/lib/po";
import { listSuppliers, type Supplier } from "@/lib/suppliers";

export const dynamic = "force-dynamic";

export default async function POPage() {
  let pos: POHeader[] = [];
  let suppliers: Supplier[] = [];
  let error: string | null = null;
  try {
    [pos, suppliers] = await Promise.all([listPOs(), listSuppliers()]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const supplierName = new Map(suppliers.map((s) => [s.id, s.name ?? s.id]));

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / purchase orders
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Purchase Orders</h1>

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
            <span className="count">{pos.length} purchase order(s)</span>
            <span className="tag">source: po.dbf</span>
            <a href="/po/new" className="tag">
              + new purchase order
            </a>
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>PO no.</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      No purchase orders yet — run <code>npm run db:import</code>{" "}
                      or add one.
                    </td>
                  </tr>
                ) : (
                  pos.map((po) => (
                    <tr key={po.id}>
                      <td>{po.po_no ?? "—"}</td>
                      <td>{po.po_date ?? "—"}</td>
                      <td>
                        {po.supplier_id
                          ? supplierName.get(po.supplier_id) ??
                            po.supplier_name ??
                            po.supplier_id
                          : po.supplier_name ?? "—"}
                      </td>
                      <td>
                        {po.received ? (
                          <span style={{ color: "var(--green)" }}>received</span>
                        ) : (
                          <span className="muted">open</span>
                        )}
                      </td>
                      <td>
                        <a href={`/po/${po.id}`}>view</a>
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
