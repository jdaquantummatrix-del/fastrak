"use client";

// The return line-item editor: a table of rows, each with an item picker, qty (in
// the line's unit), unit price, two discount %s, the unit, and a "Good" checkbox.
// "Good" is the LGOOD flag — only good (resalable) lines are put back into stock when
// the return is posted; damaged lines still credit A/R but never restock. Picking an
// item auto-fills the unit price and unit from the catalog. "Add line" appends a row;
// the trash button removes one. Rows are submitted as indexed fields
// (line-item-N / line-qty-N / line-price-N / line-disc-N / line-disc2-N / line-unit-N
// / line-good-N) plus a `lineCount` hidden input, which app/returns/actions.ts parses.
// Styles mirror app/dr/dr-lines.tsx so the form looks consistent.
import { useState, type CSSProperties } from "react";

export type ReturnItemOption = {
  value: string;
  label: string;
  unit: string | null;
  price: string | null;
};

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

type Row = {
  key: number;
  itemId: string;
  qty: string;
  price: string;
  disc: string;
  disc2: string;
  unit: string;
  good: boolean;
};

function blankRow(key: number): Row {
  return {
    key,
    itemId: "",
    qty: "",
    price: "",
    disc: "",
    disc2: "",
    unit: "",
    good: true
  };
}

export function ReturnLineEditor({ items }: { items: ReturnItemOption[] }) {
  const byId = new Map(items.map((o) => [o.value, o]));
  const [rows, setRows] = useState<Row[]>([blankRow(0)]);
  const [nextKey, setNextKey] = useState(1);

  function patch(key: number, change: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...change } : r)));
  }

  function onItem(key: number, itemId: string) {
    const opt = byId.get(itemId);
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, itemId };
        if (opt) {
          if (opt.price != null) next.price = opt.price;
          if (opt.unit != null) next.unit = opt.unit;
        }
        return next;
      })
    );
  }

  function addRow() {
    setRows((r) => [...r, blankRow(nextKey)]);
    setNextKey((k) => k + 1);
  }
  function removeRow(key: number) {
    setRows((r) => (r.length === 1 ? r : r.filter((row) => row.key !== key)));
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <span style={captionStyle}>Returned items</span>
      <input type="hidden" name="lineCount" value={rows.length} />
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...headStyle, width: "30%" }}>Item</th>
            <th style={{ ...headStyle, width: "10%" }}>Qty</th>
            <th style={{ ...headStyle, width: "14%" }}>Unit price</th>
            <th style={{ ...headStyle, width: "10%" }}>Disc %</th>
            <th style={{ ...headStyle, width: "10%" }}>Disc2 %</th>
            <th style={{ ...headStyle, width: "10%" }}>Unit</th>
            <th style={{ ...headStyle, width: "8%" }}>Good</th>
            <th style={{ width: "6%" }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.key}>
              <td style={{ padding: "4px 8px" }}>
                <select
                  style={cellInput}
                  name={`line-item-${i}`}
                  value={row.itemId}
                  onChange={(e) => onItem(row.key, e.target.value)}
                >
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
                  value={row.qty}
                  onChange={(e) => patch(row.key, { qty: e.target.value })}
                />
              </td>
              <td style={{ padding: "4px 8px" }}>
                <input
                  style={cellInput}
                  name={`line-price-${i}`}
                  type="number"
                  step="0.01"
                  min={0}
                  value={row.price}
                  onChange={(e) => patch(row.key, { price: e.target.value })}
                />
              </td>
              <td style={{ padding: "4px 8px" }}>
                <input
                  style={cellInput}
                  name={`line-disc-${i}`}
                  type="number"
                  step="0.01"
                  min={0}
                  value={row.disc}
                  onChange={(e) => patch(row.key, { disc: e.target.value })}
                />
              </td>
              <td style={{ padding: "4px 8px" }}>
                <input
                  style={cellInput}
                  name={`line-disc2-${i}`}
                  type="number"
                  step="0.01"
                  min={0}
                  value={row.disc2}
                  onChange={(e) => patch(row.key, { disc2: e.target.value })}
                />
              </td>
              <td style={{ padding: "4px 8px" }}>
                <input
                  style={cellInput}
                  name={`line-unit-${i}`}
                  maxLength={10}
                  value={row.unit}
                  onChange={(e) => patch(row.key, { unit: e.target.value })}
                />
              </td>
              <td style={{ padding: "4px 8px", textAlign: "center" }}>
                {/* a hidden 0 ensures an unchecked box still submits a value */}
                <input type="hidden" name={`line-good-${i}`} value="0" />
                <input
                  type="checkbox"
                  name={`line-good-${i}`}
                  value="1"
                  checked={row.good}
                  onChange={(e) => patch(row.key, { good: e.target.checked })}
                  aria-label="Resalable (restock on post)"
                  title="Resalable — put back into stock when posted"
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
      <button type="button" onClick={addRow} style={{ ...ghostButton, marginTop: 10 }}>
        + Add line
      </button>
    </div>
  );
}
