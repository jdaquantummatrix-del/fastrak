// Central per-field hint + example registry for the fastrak create/edit forms.
//
// Why this exists: every form field should show a one-line hint and, where
// useful, a worked example — sourced from ONE place, not scattered inline
// strings (issue #23 / S6). The shared form inputs in app/reference-ui.tsx look
// hints up here by the field's `name`, so adding a hint is a one-line edit and
// the copy stays consistent across forms.
//
// Keys are the form field `name` attribute (e.g. "tin", "mobile"). A handful of
// names mean different things on different documents; where the field name is
// already document-specific (dr_date vs po_date) the key is too. For the rare
// case where the SAME name needs different wording per form, use a composite
// key "<formContext>:<name>" and pass formContext to getFieldHint().
//
// IMPORTANT (ADR-0006): hints describe what a field MEANS, not hard validation.
// Save is lenient and validates at Post, so hints must not imply a field is
// mandatory at Save time. They guide; they don't gate.
//
// `needsKennard: true` flags a best-guess hint whose business meaning still
// needs Kennard (the legacy fastrak author) to confirm — see issue #23. These
// are surfaced by fieldHintsNeedingKennard() so they're easy to round up for a
// follow-up review rather than buried in TODO comments.

export type FieldHint = {
  // One-line hint shown under the field. Keep it short; no newlines.
  hint: string;
  // Optional worked example (e.g. a phone or TIN format). Phone/TIN fields stay
  // free text — the example is illustrative, not an enforced mask.
  example?: string;
  // True when the wording is a best guess pending Kennard's confirmation.
  needsKennard?: boolean;
};

// The registry. Base keys are field `name`s; composite "context:name" keys
// override the base for a specific form (see getFieldHint).
export const fieldHints: Record<string, FieldHint> = {
  // --- Shared / generic ---
  name: { hint: "Display name for this record, as it should appear in lists." },
  remarks: { hint: "Free-text notes for internal reference. Optional." },
  code: {
    hint: "Your unique item code or SKU — how you identify this product.",
    example: "ABC-1001",
    needsKennard: true
  },
  description: { hint: "What the item is, in plain words." },
  active: { hint: "Tick to keep this record in use; untick to retire it." },

  // --- Contact details (free text, example formats only) ---
  address: { hint: "Street address.", example: "123 Rizal Ave, Makati City" },
  contact_person: {
    hint: "Who to reach at this company.",
    example: "Maria Santos"
  },
  proprietor: { hint: "Owner or principal of the business." },
  mobile: {
    hint: "Mobile number — free text, any format you use.",
    example: "0917 123 4567"
  },
  tel_no: {
    hint: "Landline / telephone number — free text.",
    example: "(02) 8123 4567"
  },
  fax_no: { hint: "Fax number — free text, optional.", example: "(02) 8123 4568" },
  tin: {
    hint: "Tax Identification Number — free text, kept as entered.",
    example: "123-456-789-000"
  },

  // --- Items ---
  unit: {
    hint: "How this item is counted or sold.",
    example: "PCS"
  },
  unit2: {
    hint: "Alternate unit for the same item, if you sell it two ways.",
    example: "BOX",
    needsKennard: true
  },
  pack_size: {
    hint: "How many base units make one pack.",
    example: "12",
    needsKennard: true
  },
  base_cost: {
    hint: "Your buying cost per unit (YBASE). Used for margin, not shown to customers.",
    example: "85.00",
    needsKennard: true
  },
  price: {
    hint: "Default selling price per unit (YPRICE).",
    example: "120.00"
  },
  retail: {
    hint: "Suggested retail / list price per unit (YRETAIL).",
    example: "150.00",
    needsKennard: true
  },
  category_id: { hint: "Group this item belongs to, for filtering and reports." },
  brand_id: { hint: "Brand or manufacturer of this item." },
  supplier_id: { hint: "Default supplier you buy this item from." },
  critical: {
    hint: "Reorder level — flag the item as low when stock falls to this.",
    example: "10",
    needsKennard: true
  },
  category: { hint: "Name of this product group." },
  brand: { hint: "Name of this brand or manufacturer." },

  // --- Customers / suppliers ---
  type: {
    hint: "Which customer type this falls under (drives pricing/terms).",
    needsKennard: true
  },
  terms_days: {
    hint: "Payment terms in days — how long until payment is due.",
    example: "30",
    needsKennard: true
  },
  is_local: { hint: "Tick if this is a local (domestic) supplier." },

  // --- Documents: Delivery Receipt (DR) ---
  dr_no: {
    hint: "Delivery Receipt number — your reference for this sale.",
    example: "DR-2026-0042"
  },
  dr_date: { hint: "Date the goods are delivered to the customer." },
  customer_id: { hint: "Customer this document is for." },
  po_no: {
    hint: "Customer's purchase-order number, if they gave one.",
    example: "PO-88123"
  },
  doc_disc: {
    hint: "Whole-document discount, as a percentage of the total.",
    example: "5",
    needsKennard: true
  },
  add_pct: {
    hint: "Add-on percentage applied on top of the line total.",
    example: "2",
    needsKennard: true
  },

  // --- Documents: Purchase Order (PO) ---
  po_date: { hint: "Date this purchase order is placed with the supplier." },

  // --- Documents: Return ---
  return_date: { hint: "Date the goods are returned." },
  dr_id: {
    hint: "Original Delivery Receipt these goods came from, if known. Optional."
  },

  // --- Collections ---
  col_date: { hint: "Date the payment was received." },

  // --- Inventory movement ---
  in: { hint: "Units coming into stock (NIN).", example: "100" },
  out: { hint: "Units leaving stock (NOUT).", example: "100" },

  // --- Users / auth ---
  username: { hint: "Login name for this user. No spaces." },
  password: { hint: "At least 8 characters. They can change it later." },
  role: { hint: "What this user is allowed to do across modules." },
  can_see_prices: { hint: "Tick to let this user view cost and price figures." },

  // --- Generic date fallback (used when no document-specific key matches) ---
  date: { hint: "Date for this record." }
};

// Look up the hint for a field. If a form context is given, a composite
// "context:name" entry wins over the plain "name" entry. Returns null when no
// hint is registered (the form input then renders without a hint line).
export function getFieldHint(
  name: string,
  formContext?: string
): FieldHint | null {
  if (formContext) {
    const scoped = fieldHints[`${formContext}:${name}`];
    if (scoped) return scoped;
  }
  return fieldHints[name] ?? null;
}

// The field names whose hint wording still needs Kennard to confirm. Surfaced
// here so the open questions can be reviewed in one go (issue #23 follow-up).
export function fieldHintsNeedingKennard(): string[] {
  return Object.entries(fieldHints)
    .filter(([, h]) => h.needsKennard)
    .map(([name]) => name);
}
