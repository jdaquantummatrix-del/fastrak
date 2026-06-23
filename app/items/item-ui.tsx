// Item-specific form UI: a dropdown picker for the reference-data foreign keys
// (category / brand / supplier / unit). Kept here rather than in the shared
// app/reference-ui.tsx so this slice owns its own files. Styles mirror the
// inputs in reference-ui.tsx so the forms look consistent. Plain server
// component — no client JS needed.
import type { CSSProperties } from "react";

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 16
};

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

export type Option = { value: string; label: string };

// A <select> picker bound to a form field. The first option is a blank
// "— none —" so a foreign key (or unit) can be left unset.
export function SelectField({
  label,
  name,
  options,
  defaultValue,
  placeholder = "— none —"
}: {
  label: string;
  name: string;
  options: Option[];
  defaultValue?: string | null;
  placeholder?: string;
}) {
  return (
    <label style={labelStyle}>
      <span style={captionStyle}>{label}</span>
      <select style={inputStyle} name={name} defaultValue={defaultValue ?? ""}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
