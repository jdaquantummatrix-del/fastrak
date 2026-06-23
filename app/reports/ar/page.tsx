// S11 — A/R statement report (ADR-0003). The printable accounts-receivable
// statement: every customer's outstanding balance broken into aging buckets
// (current / 1-30 / 31-60 / 61-90 / 90+), with a column-total footer. Reads
// lib/ar.summarizeByCustomer (the same roll-up the A/R landing screen uses) and
// the owning lib/company for the header; shapes the footer totals with
// lib/reports.agingTotals. Money is the exact numeric(14,2) string lib/ar
// returns; we only format it. An optional ?asOf=YYYY-MM-DD ages relative to that
// date (defaults to today). Server component in the shared print layout.
import { summarizeByCustomer, type CustomerBalance } from "@/lib/ar";
import { getCompany } from "@/lib/company";
import { PrintLayout } from "../print-layout";
import { formatMoney, agingTotals } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function ARStatementPage({
  searchParams
}: {
  searchParams: Promise<{ asOf?: string }>;
}) {
  const { asOf } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const asOfDate = asOf && /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? asOf : today;

  let summary: CustomerBalance[] = [];
  let company = null;
  let error: string | null = null;
  try {
    [summary, company] = await Promise.all([
      summarizeByCustomer(undefined, asOfDate),
      getCompany()
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const totals = agingTotals(summary);

  return (
    <PrintLayout
      company={company}
      title="Statement of Accounts"
      subtitle={`Aging as of ${asOfDate}`}
      backHref="/ar"
    >
      {error ? (
        <p className="empty">Database not reachable ({error}).</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th className="num">Current</th>
              <th className="num">1–30</th>
              <th className="num">31–60</th>
              <th className="num">61–90</th>
              <th className="num">90+</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {summary.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty">
                  No outstanding receivables.
                </td>
              </tr>
            ) : (
              summary.map((r) => (
                <tr key={r.customer_id ?? "—"}>
                  <td>{r.customer_name ?? r.customer_id ?? "—"}</td>
                  <td className="num">
                    {formatMoney(r.current, { dashZero: true })}
                  </td>
                  <td className="num">
                    {formatMoney(r.d1_30, { dashZero: true })}
                  </td>
                  <td className="num">
                    {formatMoney(r.d31_60, { dashZero: true })}
                  </td>
                  <td className="num">
                    {formatMoney(r.d61_90, { dashZero: true })}
                  </td>
                  <td className="num">
                    {formatMoney(r.d90_plus, { dashZero: true })}
                  </td>
                  <td className="num">{formatMoney(r.balance)}</td>
                </tr>
              ))
            )}
          </tbody>
          {summary.length > 0 ? (
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{formatMoney(totals.current)}</td>
                <td className="num">{formatMoney(totals.d1_30)}</td>
                <td className="num">{formatMoney(totals.d31_60)}</td>
                <td className="num">{formatMoney(totals.d61_90)}</td>
                <td className="num">{formatMoney(totals.d90_plus)}</td>
                <td className="num">{formatMoney(totals.balance)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      )}
    </PrintLayout>
  );
}
