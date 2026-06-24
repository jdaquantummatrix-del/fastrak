// The "+ Add new" escape hatch (S5, issue #22): create a customer / item / supplier
// mid-document and hand the caller back a ready-to-select picker option. The whole
// point of the slide-over is that, on save, the new record is auto-selected in the
// field the user was on — so these helpers return exactly the { value, label } the
// document pickers render, with `value` being the new record's id (ADR-0002 legacy
// ids). They REUSE the existing create functions (lib/customers, lib/items,
// lib/suppliers) — no new write path. The label formatting mirrors the document
// pages (app/dr/new, app/po/new, app/returns/new) so the auto-selected option reads
// identically to its sibling options already in the dropdown.
import { type Executor, defaultExecutor } from "./reference";
import { createCustomer, type Customer, type CustomerInput } from "./customers";
import { createItem, type Item, type ItemInput } from "./items";
import { createSupplier, type Supplier, type SupplierInput } from "./suppliers";

// The shape a document picker auto-selects: a select <option>'s value + label.
export type PickerOption = { value: string; label: string };

// --- label formatters (single source of truth, shared with the document pages) ---

export function customerOptionLabel(c: Customer): string {
  return c.name ?? c.id;
}

export function supplierOptionLabel(s: Supplier): string {
  return s.name ?? s.id;
}

export function itemOptionLabel(it: Item): string {
  if (!it.code) return it.id;
  // Mirror the document pages' "code — description", but drop the dangling em-dash
  // when there is no description so a freshly added item reads cleanly in the picker.
  return it.description ? `${it.code} — ${it.description}` : it.code;
}

// --- create-and-return-option helpers (reuse the existing create path) ---

export async function addCustomerOption(
  input: CustomerInput,
  exec: Executor = defaultExecutor
): Promise<PickerOption> {
  const c = await createCustomer(input, exec);
  return { value: c.id, label: customerOptionLabel(c) };
}

export async function addItemOption(
  input: ItemInput,
  exec: Executor = defaultExecutor
): Promise<PickerOption> {
  const it = await createItem(input, exec);
  return { value: it.id, label: itemOptionLabel(it) };
}

export async function addSupplierOption(
  input: SupplierInput,
  exec: Executor = defaultExecutor
): Promise<PickerOption> {
  const s = await createSupplier(input, exec);
  return { value: s.id, label: supplierOptionLabel(s) };
}
