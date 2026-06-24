// S4 Inventory ledger — the landing screen. Two panels:
//  1. Current stock per item (sum of ins minus outs, joined to the catalog).
//  2. Movement history (newest first), each row labelled with its source doc.
// Server component, mirrors the dark style of app/items + app/customers.
import { stockByItem, listMovements, type Movement } from "@/lib/inventory";
import { listItems, type Item } from "@/lib/items";
import type { ItemStock } from "@/lib/inventory";

export const dynamic = "force-dynamic";

// Which source-document column a movement carries, for the history label.
function source(m: Movement): string {
  if (m.po_id) return `PO ${m.po_id}`;
  if (m.dr_id) return `DR ${m.dr_id}`;
  if (m.dscrp_id) return `Discrepancy ${m.dscrp_id}`;
  if (m.return_id) return `Return ${m.return_id}`;
  return "—";
}

export default async function InventoryPage() {
  let stock: ItemStock[] = [];
  let movements: Movement[] = [];
  let items: Item[] = [];
  let error: string | null = null;
  try {
    [stock, movements, items] = await Promise.all([
      stockByItem(),
      listMovements(),
      listItems()
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  // Resolve an item id to its code/description for the movement history rows.
  const itemLabel = new Map(
    items.map((it) => [it.id, it.code ?? it.description ?? it.id])
  );

  return (
    <main>
      <div className="crumb">
        <a href="/">← fastrak</a> / inventory
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Inventory</h1>

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
            <span className="count">{stock.length} item(s) in stock</span>
            <span className="tag">{movements.length} movement(s)</span>
            <span className="tag">source: inventory.dbf</span>
            <a href="/inventory/new" className="tag">
              + record movement
            </a>
          </div>

          <h2 style={{ fontSize: 18, marginTop: 24 }}>Current stock</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Unit</th>
                  <th style={{ textAlign: "right" }}>On hand</th>
                  <th style={{ textAlign: "right" }}>Critical</th>
                </tr>
              </thead>
              <tbody>
                {stock.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      No stock movements yet — run <code>npm run db:import</code>{" "}
                      or record one.
                    </td>
                  </tr>
                ) : (
                  stock.map((s) => {
                    const low = s.critical != null && s.stock <= s.critical;
                    return (
                      <tr key={s.item_id}>
                        <td>{s.code ?? "—"}</td>
                        <td>{s.description ?? "—"}</td>
                        <td>{s.unit ?? "—"}</td>
                        <td
                          style={{
                            textAlign: "right",
                            color: low ? "#f0a3a3" : undefined,
                            fontWeight: low ? 600 : undefined
                          }}
                        >
                          {s.stock}
                        </td>
                        <td style={{ textAlign: "right" }} className="muted">
                          {s.critical ?? "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: 18, marginTop: 28 }}>Movement history</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Reference</th>
                  <th>Source</th>
                  <th style={{ textAlign: "right" }}>In</th>
                  <th style={{ textAlign: "right" }}>Out</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      No movements yet.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id}>
                      <td>{m.movement_date ?? "—"}</td>
                      <td>
                        {m.item_id ? itemLabel.get(m.item_id) ?? m.item_id : "—"}
                      </td>
                      <td>{m.ref_no ?? m.name ?? "—"}</td>
                      <td className="muted">{source(m)}</td>
                      <td style={{ textAlign: "right" }}>
                        {m.qty_in ? m.qty_in : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {m.qty_out ? m.qty_out : "—"}
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
