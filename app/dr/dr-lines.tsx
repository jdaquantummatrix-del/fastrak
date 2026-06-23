"use client";

// The DR line-item editor: a table of rows, each with an item picker, qty (boxes),
// pcs (qty2 — the piece count fastrak's money math operates on), unit price and two
// discount %s. Picking an item auto-fills the unit price from the catalog and, when
// a pack size is known, derives pcs = qty * pack. "Add line" appends a row; the
// trash button removes one. Rows are submitted as indexed fields
// (line-item-N / line-qty-N / line-pcs-N / line-price-N / line-disc-N / line-disc2-N
// / line-unit-N) plus a `lineCount` hidden input, which app/dr/actions.ts parses.
// Styles mirror app/po/po-lines.tsx so the form looks consistent.
import { useState, type CSSProperties } from "react";

export type DRItemOption = {
  value: string;
  label: string;
  unit: string | null;
  price: string | null;
  pack: number | null;
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
  pcs: string;
  price: string;
  disc: string;
  disc2: string;
  unit: string;
};

function blankRow(key: number): Row {
  return { key, itemId: "", qty: "", pcs: "", price: "", disc: "", disc2: "", unit: "" };
}

export type DRLineInitial = {
  itemId: string;
  qty: string;
  pcs: string;
  price: string;
  disc: string;
  disc2: string;
  unit: string;
};

export function DRLineEditor({
  items,
  initial
}: {
  items: DRItemOption[];
  initial?: DRLineInitial[];
}) {
  const byId = new Map(items.map((o) => [o.value, o]));
  const seed: Row[] =
    initial && initial.length > 0
      ? initial.map((r, i) => ({ key: i, ...r }))
      : [blankRow(0)];
  const [rows, setRows] = useState<Row[]>(seed);
  const [nextKey, setNextKey] = useState(seed.length);

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
          // derive pcs from qty * pack when both are known
          const qtyN = Number(r.qty);
          if (opt.pack != null && Number.isFinite(qtyN) && r.qty.trim() !== "") {
            next.pcs = String(qtyN * opt.pack);
          }
        }
        return next;
      })
    );
  }

  function onQty(key: number, qty: string) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, qty };
        const opt = byId.get(r.itemId);
        const qtyN = Number(qty);
        if (opt?.pack != null && Number.isFinite(qtyN) && qty.trim() !== "") {
          next.pcs = String(qtyN * opt.pack);
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
      <span style={captionStyle}>Line items</span>
      <input type="hidden" name="lineCount" value={rows.length} />
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...headStyle, width: "30%" }}>Item</th>
            <th style={{ ...headStyle, width: "9%" }}>Qty</th>
            <th style={{ ...headStyle, width: "11%" }}>Pcs</th>
            <th style={{ ...headStyle, width: "14%" }}>Unit price</th>
            <th style={{ ...headStyle, width: "10%" }}>Disc %</th>
            <th style={{ ...headStyle, width: "10%" }}>Disc2 %</th>
            <th style={{ ...headStyle, width: "10%" }}>Unit</th>
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
                  onChange={(e) => onQty(row.key, e.target.value)}
                />
              </td>
              <td style={{ padding: "4px 8px" }}>
                <input
                  style={cellInput}
                  name={`line-pcs-${i}`}
                  type="number"
                  min={0}
                  value={row.pcs}
                  onChange={(e) => patch(row.key, { pcs: e.target.value })}
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
