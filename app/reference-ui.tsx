// Shared, dependency-free form UI for the S1 reference-data screens (units,
// categories, brands, suppliers) and the document forms. Styles are inline so we
// don't have to touch the shared app/globals.css. Plain server components.
//
// Each input renders a one-line hint (and, where useful, an example) sourced
// from the central registry in lib/field-hints.ts — keyed by the field `name`,
// with an optional per-form `formContext` (issue #23 / S6). Pass `hint`/`example`
// explicitly to override the registry for a one-off field.
import type { CSSProperties, ReactNode } from "react";
import { getFieldHint } from "@/lib/field-hints";

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

const hintStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  lineHeight: 1.4,
  color: "var(--muted)",
  marginTop: 5
};

const exampleStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  color: "var(--ink)"
};

// Resolve and render the one-line hint + example for a field. Returns null when
// neither an explicit hint nor a registry entry exists, so plain fields with no
// guidance simply render nothing extra.
function FieldHintLine({
  name,
  formContext,
  hint,
  example
}: {
  name: string;
  formContext?: string;
  hint?: string;
  example?: string;
}) {
  const registered = getFieldHint(name, formContext);
  const text = hint ?? registered?.hint;
  const ex = example ?? registered?.example;
  if (!text && !ex) return null;
  return (
    <span style={hintStyle}>
      {text}
      {ex ? (
        <>
          {text ? " " : ""}
          <span style={exampleStyle}>e.g. {ex}</span>
        </>
      ) : null}
    </span>
  );
}

export function Field({
  label,
  name,
  defaultValue,
  required,
  maxLength,
  autoFocus,
  type = "text",
  formContext,
  hint,
  example
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  required?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  type?: "text" | "number";
  formContext?: string;
  hint?: string;
  example?: string;
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
      <FieldHintLine name={name} formContext={formContext} hint={hint} example={example} />
    </label>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  required,
  autoFocus,
  placeholder,
  formContext,
  hint,
  example
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  required?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  formContext?: string;
  hint?: string;
  example?: string;
}) {
  return (
    <label style={labelStyle}>
      <span style={captionStyle}>{label}</span>
      <select
        style={inputStyle}
        name={name}
        required={required}
        autoFocus={autoFocus}
        defaultValue={defaultValue ?? ""}
      >
        <option value="">{placeholder ?? "—"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldHintLine name={name} formContext={formContext} hint={hint} example={example} />
    </label>
  );
}

export function CheckboxField({
  label,
  name,
  defaultChecked,
  formContext,
  hint
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  formContext?: string;
  hint?: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input type="checkbox" name={name} value="1" defaultChecked={defaultChecked} />
        <span style={{ fontSize: 14 }}>{label}</span>
      </label>
      <FieldHintLine name={name} formContext={formContext} hint={hint} />
    </div>
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
