// A single Purchase Order: header detail + its line items, with a "Receive"
// button that posts the order into stock (one inventory IN movement per line).
// Once received the button is replaced by a status badge. Server component.
import { notFound } from "next/navigation";
import { getPO } from "@/lib/po";
import { getSupplier } from "@/lib/suppliers";
import { listItems } from "@/lib/items";
import { receivePOAction } from "../actions";

export const dynamic = "force-dynamic";

const receiveButtonStyle = {
  background: "var(--green)",
  color: "#0c0e14",
  border: "none",
  borderRadius: 8,
  font: "inherit",
  fontWeight: 600,
  fontSize: 14,
  padding: "9px 16px",
  cursor: "pointer"
} as const;

export default async function POPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const po = await getPO(id);
  if (!po) notFound();

  const [supplier, items] = await Promise.all([
    po.supplier_id ? getSupplier(po.supplier_id) : Promise.resolve(null),
    listItems()
  ]);
  const itemLabel = new Map(
    items.map((it) => [it.id, it.code ?? it.description ?? it.id])
  );

  const receive = receivePOAction.bind(null, po.id);

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> /{" "}
        <a href="/po">purchase orders</a> / {po.po_no ?? po.id}
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Purchase order {po.po_no ?? ""}</h1>
      <p className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
        {po.id}
      </p>

      <div className="badge-row">
        <span className="tag">date: {po.po_date ?? "—"}</span>
        <span className="tag">
          supplier: {supplier?.name ?? po.supplier_name ?? "—"}
        </span>
        {po.received ? (
          <span className="count">received into stock</span>
        ) : (
          <form action={receive}>
            <button type="submit" style={receiveButtonStyle}>
              Receive into stock
            </button>
          </form>
        )}
      </div>

      {po.remarks ? (
        <p className="muted" style={{ marginTop: 4 }}>
          {po.remarks}
        </p>
      ) : null}

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Line items</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style={{ textAlign: "right" }}>Qty</th>
              <th>Unit</th>
              <th style={{ textAlign: "right" }}>Unit cost</th>
              <th style={{ textAlign: "right" }}>Line total</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No line items.
                </td>
              </tr>
            ) : (
              po.lines.map((line) => {
                const cost = line.base_cost == null ? null : Number(line.base_cost);
                const total = cost == null ? null : cost * line.qty;
                return (
                  <tr key={line.id}>
                    <td>
                      {line.item_id
                        ? itemLabel.get(line.item_id) ??
                          line.description ??
                          line.item_id
                        : line.description ?? "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>{line.qty}</td>
                    <td>{line.unit ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      {line.base_cost ?? "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {total == null ? "—" : total.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
