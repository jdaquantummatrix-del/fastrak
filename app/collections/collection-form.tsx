"use client";

// The "new collection" form. Recording a collection is: pick the paying customer, the
// payment date and a note, then apply the payment across that customer's OUTSTANDING
// A/R rows. Picking a customer reveals only their open receivables (one row each, with
// the amount owed); ticking a row includes it in the payment and pre-fills the amount
// to the full balance, which the user can lower for a partial payment.
//
// The customer picker and the A/R table share state, so the table re-filters the moment
// a different customer is chosen — that is why the whole form is one client component
// (the server page passes the customer list and every open A/R row + its customer).
// Rows are submitted as indexed fields (line-ar-N / line-amount-N) plus a `lineCount`
// hidden input, which app/collections/actions.ts parses (it drops unticked / zero rows).
// Styles mirror app/dr/dr-lines.tsx + app/returns/return-lines.tsx for consistency.
import { useMemo, useState, type CSSProperties } from "react";
import { createCollectionAction } from "./actions";

export type OpenAR = {
  id: string;
  customer_id: string | null;
  dr_no: string | null;
  due_date: string | null;
  amount: string; // outstanding balance on this row (exact decimal string)
};

export type CustomerOption = { value: string; label: string };

const labelStyle: CSSProperties = { display: "block", marginBottom: 16 };

const captionStyle: CSSProperties = {
  display: "block",
  fontFamily: "var(--mono)",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--muted)",
  marginBottom: 6
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--panel2)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  color: "var(--ink)",
  font: "inherit",
  fontSize: 14,
  padding: "9px 11px"
};

const cellInput: CSSProperties = { ...inputStyle, padding: "8px 10px" };

const headStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--muted)",
  textAlign: "left",
  padding: "0 8px 6px",
  fontWeight: 600
};

const buttonStyle: CSSProperties = {
  background: "var(--accent)",
  color: "#0c0e14",
  border: "none",
  borderRadius: 8,
  font: "inherit",
  fontWeight: 600,
  fontSize: 14,
  padding: "9px 16px",
  cursor: "pointer"
};

// Money as a grouped string (e.g. "1,234.50") for display.
function peso(v: string | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

type Applied = { checked: boolean; amount: string };

export function CollectionForm({
  customers,
  openAR
}: {
  customers: CustomerOption[];
  openAR: OpenAR[];
}) {
  const [customerId, setCustomerId] = useState("");
  // Per-A/R-row payment state, keyed by A/R id.
  const [applied, setApplied] = useState<Record<string, Applied>>({});

  // The selected customer's outstanding receivables (a positive balance only).
  const rows = useMemo(
    () =>
      openAR.filter(
        (a) => a.customer_id === customerId && Number(a.amount) > 0
      ),
    [openAR, customerId]
  );

  function setRow(id: string, change: Partial<Applied>, fallbackAmount: string) {
    setApplied((prev) => {
      const cur = prev[id] ?? { checked: false, amount: fallbackAmount };
      return { ...prev, [id]: { ...cur, ...change } };
    });
  }

  // The running total of what is being applied (only ticked rows with a value).
  const total = rows.reduce((s, a) => {
    const row = applied[a.id];
    if (!row?.checked) return s;
    const n = Number(row.amount);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);

  return (
    <form action={createCollectionAction}>
      <label style={labelStyle}>
        <span style={captionStyle}>Date</span>
        <input style={inputStyle} name="col_date" type="date" />
      </label>

      <label style={labelStyle}>
        <span style={captionStyle}>Customer</span>
        <select
          style={inputStyle}
          name="customer_id"
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value);
            setApplied({}); // a new customer resets the payment lines
          }}
        >
          <option value="">— select a customer —</option>
          {customers.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label style={labelStyle}>
        <span style={captionStyle}>Remarks</span>
        <input style={inputStyle} name="remarks" maxLength={150} />
      </label>

      <span style={captionStyle}>Apply payment to outstanding receivables</span>
      <input type="hidden" name="lineCount" value={rows.length} />
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...headStyle, width: "8%" }}>Pay</th>
            <th style={{ ...headStyle, width: "26%" }}>DR no.</th>
            <th style={{ ...headStyle, width: "22%" }}>Due</th>
            <th style={{ ...headStyle, textAlign: "right", width: "22%" }}>Owed</th>
            <th style={{ ...headStyle, textAlign: "right", width: "22%" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted" style={{ padding: "10px 8px" }}>
                {customerId === ""
                  ? "Select a customer to see their outstanding receivables."
                  : "This customer has no outstanding receivables."}
              </td>
            </tr>
          ) : (
            rows.map((a, i) => {
              const row = applied[a.id] ?? { checked: false, amount: a.amount };
              return (
                <tr key={a.id}>
                  <td style={{ padding: "6px 8px", textAlign: "center" }}>
                    <input type="hidden" name={`line-ar-${i}`} value={a.id} />
                    <input
                      type="checkbox"
                      checked={row.checked}
                      onChange={(e) =>
                        setRow(a.id, { checked: e.target.checked }, a.amount)
                      }
                      aria-label={`Pay ${a.dr_no ?? a.id}`}
                    />
                  </td>
                  <td style={{ padding: "6px 8px" }}>{a.dr_no ?? a.id}</td>
                  <td style={{ padding: "6px 8px" }}>{a.due_date ?? "—"}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>
                    {peso(a.amount)}
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      style={{ ...cellInput, textAlign: "right" }}
                      name={`line-amount-${i}`}
                      type="number"
                      step="0.01"
                      min={0}
                      max={Number(a.amount)}
                      value={row.checked ? row.amount : ""}
                      disabled={!row.checked}
                      onChange={(e) =>
                        setRow(a.id, { amount: e.target.value }, a.amount)
                      }
                    />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 18
        }}
      >
        <span style={{ fontWeight: 600 }}>
          Total to collect: {peso(total.toFixed(2))}
        </span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href="/collections" className="tag">
            cancel
          </a>
          <button type="submit" style={buttonStyle} disabled={total <= 0}>
            Record collection
          </button>
        </div>
      </div>
    </form>
  );
}
