// A single Delivery Receipt: header detail, its line items, the computed money
// totals (gross / line discount / add-on / document discount / grand total — all
// the way fastrak computes them), and Post / Cancel controls. Posting releases
// stock (one inventory OUT of qty2 per line) and freezes the document; cancelling
// voids it and reverses any posted stock. Server component.
import { notFound } from "next/navigation";
import { getDR } from "@/lib/dr";
import { getCustomer } from "@/lib/customers";
import { listItems } from "@/lib/items";
import { postDRAction, cancelDRAction } from "../actions";

export const dynamic = "force-dynamic";

const postButtonStyle = {
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

const cancelButtonStyle = {
  background: "var(--panel2)",
  color: "#f0a3a3",
  border: "1px solid var(--line)",
  borderRadius: 8,
  font: "inherit",
  fontWeight: 600,
  fontSize: 14,
  padding: "9px 16px",
  cursor: "pointer"
} as const;

function lineAmount(price: string | null, qty2: number): string {
  if (price == null) return "—";
  return (Number(price) * qty2).toFixed(2);
}

export default async function DRDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dr = await getDR(id);
  if (!dr) notFound();

  const [customer, items] = await Promise.all([
    dr.customer_id ? getCustomer(dr.customer_id) : Promise.resolve(null),
    listItems()
  ]);
  const itemLabel = new Map(
    items.map((it) => [it.id, it.code ?? it.description ?? it.id])
  );

  const post = postDRAction.bind(null, dr.id);
  const cancel = cancelDRAction.bind(null, dr.id);

  const status = dr.cancelled
    ? { label: "cancelled", color: "#f0a3a3" }
    : dr.posted
      ? { label: "posted into stock", color: "var(--green)" }
      : { label: "open", color: "var(--muted)" };

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> /{" "}
        <a href="/dr">delivery receipts</a> / {dr.dr_no ?? dr.id}
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Delivery receipt {dr.dr_no ?? ""}</h1>
      <p className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
        {dr.id}
      </p>

      <div className="badge-row">
        <span className="tag">date: {dr.dr_date ?? "—"}</span>
        <span className="tag">customer: {customer?.name ?? "—"}</span>
        <span className="tag">terms: {dr.terms_days} day(s)</span>
        <span style={{ color: status.color }}>{status.label}</span>
      </div>

      <div className="badge-row">
        {!dr.posted && !dr.cancelled ? (
          <>
            <a href={`/dr/${dr.id}/edit`} className="tag">
              edit
            </a>
            <form action={post}>
              <button type="submit" style={postButtonStyle}>
                Post into stock
              </button>
            </form>
          </>
        ) : null}
        {!dr.cancelled ? (
          <form action={cancel}>
            <button type="submit" style={cancelButtonStyle}>
              {dr.posted ? "Cancel & reverse" : "Cancel"}
            </button>
          </form>
        ) : null}
        <a href={`/dr/${dr.id}/print`} className="tag">
          print
        </a>
        <a href={`/dr/${dr.id}/print?price=no`} className="tag">
          print (no price)
        </a>
      </div>

      {dr.address ? (
        <p className="muted" style={{ marginTop: 4 }}>
          Ship to: {dr.address}
        </p>
      ) : null}
      {dr.remarks ? (
        <p className="muted" style={{ marginTop: 4 }}>
          {dr.remarks}
        </p>
      ) : null}

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Line items</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style={{ textAlign: "right" }}>Qty</th>
              <th style={{ textAlign: "right" }}>Pcs</th>
              <th>Unit</th>
              <th style={{ textAlign: "right" }}>Unit price</th>
              <th style={{ textAlign: "right" }}>Disc %</th>
              <th style={{ textAlign: "right" }}>Disc2 %</th>
              <th style={{ textAlign: "right" }}>Gross</th>
            </tr>
          </thead>
          <tbody>
            {dr.lines.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  No line items.
                </td>
              </tr>
            ) : (
              dr.lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    {line.item_id
                      ? itemLabel.get(line.item_id) ??
                        line.description ??
                        line.item_id
                      : line.description ?? "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>{line.qty}</td>
                  <td style={{ textAlign: "right" }}>{line.qty2}</td>
                  <td>{line.unit ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>{line.price ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>{line.disc ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>{line.disc2 ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    {lineAmount(line.price, line.qty2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Totals</h2>
      <div className="card" style={{ padding: "18px 20px" }}>
        <table>
          <tbody>
            <tr>
              <td className="muted">Gross (pcs × price)</td>
              <td style={{ textAlign: "right" }}>{dr.gross}</td>
            </tr>
            <tr>
              <td className="muted">Net (after line discounts)</td>
              <td style={{ textAlign: "right" }}>{dr.net}</td>
            </tr>
            <tr>
              <td className="muted">Add-on ({dr.add_pct ?? "0"}%)</td>
              <td style={{ textAlign: "right" }}>+ {dr.add_amount}</td>
            </tr>
            <tr>
              <td className="muted">Document discount ({dr.doc_disc ?? "0"}%)</td>
              <td style={{ textAlign: "right" }}>- {dr.doc_disc_amount}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Grand total</td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>{dr.total}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
