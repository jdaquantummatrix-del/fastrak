// Inventory-specific form UI: a <select> picker (for the item FK and the
// source-document type) and a date input. Kept in this slice's own folder so it
// does not touch shared files. Styles mirror app/reference-ui.tsx so the forms
// look consistent. Plain server component — no client JS needed.
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

// A <select> picker bound to a form field. When `placeholder` is given, the
// first option is a blank one so the field can be left unset.
export function SelectField({
  label,
  name,
  options,
  defaultValue,
  placeholder,
  required
}: {
  label: string;
  name: string;
  options: Option[];
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label style={labelStyle}>
      <span style={captionStyle}>{label}</span>
      <select
        style={inputStyle}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
      >
        {placeholder != null && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// A plain date input (type=date) -> submits "YYYY-MM-DD".
export function DateField({
  label,
  name,
  defaultValue
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <label style={labelStyle}>
      <span style={captionStyle}>{label}</span>
      <input
        style={inputStyle}
        name={name}
        type="date"
        defaultValue={defaultValue ?? ""}
      />
    </label>
  );
}
