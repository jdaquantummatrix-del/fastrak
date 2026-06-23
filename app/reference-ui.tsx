// Shared, dependency-free form UI for the S1 reference-data screens (units,
// categories, brands, suppliers). Styles are inline so we don't have to touch
// the shared app/globals.css. Plain server components (no client JS needed).
import type { CSSProperties, ReactNode } from "react";

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

const actionsStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  marginTop: 8
};

export function Field({
  label,
  name,
  defaultValue,
  required,
  maxLength,
  autoFocus,
  type = "text"
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  required?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  type?: "text" | "number";
}) {
  return (
    <label style={labelStyle}>
      <span style={captionStyle}>{label}</span>
      <input
        style={inputStyle}
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        autoFocus={autoFocus}
        defaultValue={defaultValue ?? ""}
      />
    </label>
  );
}

export function CheckboxField({
  label,
  name,
  defaultChecked
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label
      style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}
    >
      <input type="checkbox" name={name} value="1" defaultChecked={defaultChecked} />
      <span style={{ fontSize: 14 }}>{label}</span>
    </label>
  );
}

export function FormActions({
  submitLabel,
  cancelHref
}: {
  submitLabel: string;
  cancelHref: string;
}) {
  return (
    <div style={actionsStyle}>
      <button type="submit" style={buttonStyle}>
        {submitLabel}
      </button>
      <a href={cancelHref} className="tag">
        cancel
      </a>
    </div>
  );
}

export function FormCard({ children }: { children: ReactNode }) {
  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      {children}
    </div>
  );
}
