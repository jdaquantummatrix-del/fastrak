// A single Return: header detail, its returned-item lines (with the Good/resalable
// flag), the computed total value (what comes off the customer's A/R), and a Post /
// Un-post control. Posting puts each GOOD line's qty back into stock (one inventory
// IN) and raises an offsetting A/R credit of the return value; un-posting reverses
// both. Server component.
import { notFound } from "next/navigation";
import { getReturn } from "@/lib/returns";
import { getCustomer } from "@/lib/customers";
import { getDR } from "@/lib/dr";
import { listItems } from "@/lib/items";
import { postReturnAction, unpostReturnAction } from "../actions";

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

const unpostButtonStyle = {
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

function lineAmount(price: string | null, qty: number): string {
  if (price == null) return "—";
  return (Number(price) * qty).toFixed(2);
}

export default async function ReturnDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ret = await getReturn(id);
  if (!ret) notFound();

  const [customer, dr, items] = await Promise.all([
    ret.customer_id ? getCustomer(ret.customer_id) : Promise.resolve(null),
    ret.dr_id ? getDR(ret.dr_id) : Promise.resolve(null),
    listItems()
  ]);
  const itemLabel = new Map(
    items.map((it) => [it.id, it.code ?? it.description ?? it.id])
  );

  const post = postReturnAction.bind(null, ret.id);
  const unpost = unpostReturnAction.bind(null, ret.id);

  const status = ret.posted
    ? { label: "posted (stock raised, A/R credited)", color: "var(--green)" }
    : { label: "open", color: "var(--muted)" };

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / <a href="/returns">returns</a> / {ret.id}
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Return</h1>
      <p className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
        {ret.id}
      </p>

      <div className="badge-row">
        <span className="tag">date: {ret.return_date ?? "—"}</span>
        <span className="tag">customer: {customer?.name ?? "—"}</span>
        {dr ? <span className="tag">DR: {dr.dr_no ?? dr.id}</span> : null}
        <span style={{ color: status.color }}>{status.label}</span>
      </div>

      <div className="badge-row">
        {!ret.posted ? (
          <form action={post}>
            <button type="submit" style={postButtonStyle}>
              Post return
            </button>
          </form>
        ) : (
          <form action={unpost}>
            <button type="submit" style={unpostButtonStyle}>
              Un-post &amp; reverse
            </button>
          </form>
        )}
      </div>

      {ret.remarks ? (
        <p className="muted" style={{ marginTop: 4 }}>
          {ret.remarks}
        </p>
      ) : null}

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Returned items</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style={{ textAlign: "right" }}>Qty</th>
              <th>Unit</th>
              <th style={{ textAlign: "right" }}>Unit price</th>
              <th style={{ textAlign: "right" }}>Disc %</th>
              <th style={{ textAlign: "right" }}>Disc2 %</th>
              <th>Good</th>
              <th style={{ textAlign: "right" }}>Gross</th>
            </tr>
          </thead>
          <tbody>
            {ret.lines.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  No line items.
                </td>
              </tr>
            ) : (
              ret.lines.map((line) => (
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
                  <td style={{ textAlign: "right" }}>{line.price ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>{line.disc ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>{line.disc2 ?? "—"}</td>
                  <td
                    style={{
                      color: line.good ? "var(--green)" : "var(--muted)"
                    }}
                  >
                    {line.good ? "yes" : "no"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {lineAmount(line.price, line.qty)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Total</h2>
      <div className="card" style={{ padding: "18px 20px" }}>
        <table>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600 }}>
                Return value (credited to A/R on post)
              </td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>{ret.value}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
