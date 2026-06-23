// S11 — Delivery Receipt printout (ADR-0003). The printable form of one DR,
// reproducing the header + lines + computed totals from lib/dr. fastrak prints
// the DR in two main forms; this single template covers both via a query param:
//   /dr/[id]/print            -> priced (unit price, line amount, totals shown)
//   /dr/[id]/print?price=no   -> no-price (a packing-slip style: qty + item only)
// Money is the exact numeric(14,2) string lib/dr returns; we only format it.
// Server component, wrapped in the shared print layout. (Remaining per-printer /
// paper-size variants from ADR-0003 are follow-up — see the slice notes.)
import { notFound } from "next/navigation";
import { getDR } from "@/lib/dr";
import { getCustomer } from "@/lib/customers";
import { listItems } from "@/lib/items";
import { getCompany } from "@/lib/company";
import { PrintLayout } from "../../../reports/print-layout";
import { formatMoney, drLineAmount } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function DRPrintPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ price?: string }>;
}) {
  const { id } = await params;
  const { price } = await searchParams;
  // priced is the default; ?price=no (or =0/false) switches to the no-price form.
  const priced = !["no", "0", "false", "none"].includes((price ?? "").toLowerCase());

  const dr = await getDR(id);
  if (!dr) notFound();

  const [customer, items, company] = await Promise.all([
    dr.customer_id ? getCustomer(dr.customer_id) : Promise.resolve(null),
    listItems(),
    getCompany()
  ]);
  const itemLabel = new Map(
    items.map((it) => [it.id, it.description ?? it.code ?? it.id])
  );
  const itemCode = new Map(items.map((it) => [it.id, it.code ?? ""]));

  const status = dr.cancelled
    ? "CANCELLED"
    : dr.posted
      ? "POSTED"
      : "OPEN";

  return (
    <PrintLayout
      company={company}
      title="Delivery Receipt"
      subtitle={`${priced ? "Priced" : "No price"} • ${status}`}
      backHref={`/dr/${dr.id}`}
    >
      <div className="doc-meta">
        <div>
          <div className="label">DR No.</div>
          {dr.dr_no ?? "—"}
        </div>
        <div>
          <div className="label">Date</div>
          {dr.dr_date ?? "—"}
        </div>
        <div>
          <div className="label">Customer</div>
          {customer?.name ?? "—"}
        </div>
        <div>
          <div className="label">Terms</div>
          {dr.terms_days} day(s)
        </div>
        {dr.po_no ? (
          <div>
            <div className="label">P.O. No.</div>
            {dr.po_no}
          </div>
        ) : null}
        {dr.address ?? customer?.address ? (
          <div style={{ minWidth: 280 }}>
            <div className="label">Ship to</div>
            {dr.address ?? customer?.address}
          </div>
        ) : null}
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: 90 }}>Code</th>
            <th>Description</th>
            <th className="num">Qty</th>
            <th>Unit</th>
            <th className="num">Pcs</th>
            {priced ? (
              <>
                <th className="num">Unit price</th>
                <th className="num">Disc</th>
                <th className="num">Amount</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {dr.lines.length === 0 ? (
            <tr>
              <td colSpan={priced ? 8 : 5} className="empty">
                No line items.
              </td>
            </tr>
          ) : (
            dr.lines.map((line) => {
              const label = line.item_id
                ? itemLabel.get(line.item_id) ?? line.description ?? line.item_id
                : line.description ?? "—";
              const code = line.item_id
                ? itemCode.get(line.item_id) ?? line.code ?? ""
                : line.code ?? "";
              // The two line discounts shown as "10/5" (or "—" when none).
              const disc =
                [line.disc, line.disc2]
                  .filter((d) => d != null && Number(d) > 0)
                  .map((d) => Number(d))
                  .join("/") || "—";
              return (
                <tr key={line.id}>
                  <td>{code || "—"}</td>
                  <td>{label}</td>
                  <td className="num">{line.qty}</td>
                  <td>{line.unit ?? "—"}</td>
                  <td className="num">{line.qty2}</td>
                  {priced ? (
                    <>
                      <td className="num">
                        {line.price != null ? formatMoney(line.price) : "—"}
                      </td>
                      <td className="num">{disc}</td>
                      <td className="num">
                        {formatMoney(drLineAmount(line), { dashZero: true })}
                      </td>
                    </>
                  ) : null}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {priced ? (
        <table className="totals">
          <tbody>
            <tr>
              <td>Gross</td>
              <td className="num">{formatMoney(dr.gross)}</td>
            </tr>
            <tr>
              <td>Net (after line discounts)</td>
              <td className="num">{formatMoney(dr.net)}</td>
            </tr>
            {Number(dr.add_amount) ? (
              <tr>
                <td>Add-on ({dr.add_pct ?? "0"}%)</td>
                <td className="num">{formatMoney(dr.add_amount)}</td>
              </tr>
            ) : null}
            {Number(dr.doc_disc_amount) ? (
              <tr>
                <td>Less: discount ({dr.doc_disc ?? "0"}%)</td>
                <td className="num">({formatMoney(dr.doc_disc_amount)})</td>
              </tr>
            ) : null}
            <tr className="grand">
              <td>Grand total</td>
              <td className="num">{formatMoney(dr.total)}</td>
            </tr>
          </tbody>
        </table>
      ) : null}

      {dr.remarks ? (
        <p style={{ marginTop: 18, fontSize: 12 }}>Remarks: {dr.remarks}</p>
      ) : null}
    </PrintLayout>
  );
}
