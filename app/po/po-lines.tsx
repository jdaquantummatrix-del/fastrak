"use client";

// The PO line-item editor: a table of rows, each with an item picker, qty, unit
// cost and unit. "Add line" appends a row; the trash button removes one. Rows are
// submitted as indexed fields (line-item-N / line-qty-N / line-cost-N /
// line-unit-N) plus a `lineCount` hidden input, which app/po/actions.ts parses.
// Styles mirror the inputs in app/reference-ui.tsx so the form looks consistent.
import { useState, type CSSProperties } from "react";

export type ItemOption = { value: string; label: string; unit: string | null };

const cellInput: CSSProperties = {
  width: "100%",
  background: "var(--panel2)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  color: "var(--ink)",
  font: "inherit",
  fontSize: 14,
  padding: "8px 10px"
};

const captionStyle: CSSProperties = {
  display: "block",
  fontFamily: "var(--mono)",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--muted)",
  marginBottom: 8
};

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

const ghostButton: CSSProperties = {
  background: "var(--panel2)",
  color: "var(--ink)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  font: "inherit",
  fontSize: 13,
  padding: "7px 13px",
  cursor: "pointer"
};

type Row = { key: number };

export function POLineEditor({ items }: { items: ItemOption[] }) {
  const [rows, setRows] = useState<Row[]>([{ key: 0 }]);
  const [nextKey, setNextKey] = useState(1);

  function addRow() {
    setRows((r) => [...r, { key: nextKey }]);
    setNextKey((k) => k + 1);
  }
  function removeRow(key: number) {
    setRows((r) => (r.length === 1 ? r : r.filter((row) => row.key !== key)));
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <span style={captionStyle}>Line items</span>
      {/* index by position so actions.ts can read line-*-i sequentially */}
      <input type="hidden" name="lineCount" value={rows.length} />
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...headStyle, width: "46%" }}>Item</th>
            <th style={{ ...headStyle, width: "16%" }}>Qty</th>
            <th style={{ ...headStyle, width: "20%" }}>Unit cost</th>
            <th style={{ ...headStyle, width: "12%" }}>Unit</th>
            <th style={{ width: "6%" }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.key}>
              <td style={{ padding: "4px 8px" }}>
                <select style={cellInput} name={`line-item-${i}`} defaultValue="">
                  <option value="">— select item —</option>
                  {items.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </td>
              <td style={{ padding: "4px 8px" }}>
                <input
                  style={cellInput}
                  name={`line-qty-${i}`}
                  type="number"
                  min={0}
                  defaultValue=""
                />
              </td>
              <td style={{ padding: "4px 8px" }}>
                <input
                  style={cellInput}
                  name={`line-cost-${i}`}
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue=""
                />
              </td>
              <td style={{ padding: "4px 8px" }}>
                <input
                  style={cellInput}
                  name={`line-unit-${i}`}
                  maxLength={10}
                  defaultValue=""
                />
              </td>
              <td style={{ padding: "4px 8px", textAlign: "center" }}>
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  style={{ ...ghostButton, padding: "7px 10px" }}
                  aria-label="Remove line"
                  title="Remove line"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={addRow}
        style={{ ...ghostButton, marginTop: 10 }}
      >
        + Add line
      </button>
    </div>
  );
}
