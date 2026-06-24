// A single Collection: header detail, the payment lines (each settling one A/R row,
// with the DR number, due date and amount applied), and the collected total. Recording
// this collection already reduced the targeted receivables — this screen is read-only.
// Server component.
import { notFound } from "next/navigation";
import { getCollection } from "@/lib/collections";
import { getCustomer } from "@/lib/customers";

export const dynamic = "force-dynamic";

// Money as a grouped string (e.g. "1,234.50"); blank/zero shows as a muted dash.
function peso(v: string | null | undefined): string {
  const n = Number(v ?? 0);
  if (!n) return "—";
  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export default async function CollectionDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const col = await getCollection(id);
  if (!col) notFound();

  const customer = col.customer_id ? await getCustomer(col.customer_id) : null;

  return (
    <main>
      <div className="crumb">
        <a href="/">← fastrak</a> /{" "}
        <a href="/collections">collections</a> / {col.id}
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Collection</h1>
      <p className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
        {col.id}
      </p>

      <div className="badge-row">
        <span className="tag">date: {col.col_date ?? "—"}</span>
        <span className="tag">customer: {customer?.name ?? "—"}</span>
        <span className="tag">collected: {peso(col.total)}</span>
      </div>

      {col.remarks ? (
        <p className="muted" style={{ marginTop: 4 }}>
          {col.remarks}
        </p>
      ) : null}

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Applied to receivables</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>DR no.</th>
              <th>A/R date</th>
              <th>Due</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {col.lines.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No payment lines.
                </td>
              </tr>
            ) : (
              col.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.dr_no ?? line.ar_id ?? "—"}</td>
                  <td>{line.ar_date ?? "—"}</td>
                  <td>{line.due_date ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>{peso(line.amount)}</td>
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
              <td style={{ fontWeight: 600 }}>Collected (reduced A/R by this)</td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>
                {peso(col.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
