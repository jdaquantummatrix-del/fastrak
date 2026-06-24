// Create a Purchase Order: pick the supplier and date, then add one or more line
// items (item picker + qty + unit cost + unit). Submits to createPOAction.
// Server component; the dynamic line rows live in the POLineEditor client
// component. The supplier/source pickers reuse the inventory slice's SelectField.
import { listSuppliers } from "@/lib/suppliers";
import { listItems } from "@/lib/items";
import { createPOAction } from "../actions";
import { Field, FormActions, FormCard } from "../../reference-ui";
import { SelectField, DateField, type Option } from "../../inventory/movement-ui";
import { POLineEditor, type ItemOption } from "../po-lines";
import { DraftForm } from "../../_components/draft-form";

export const dynamic = "force-dynamic";

export default async function NewPOPage() {
  const [suppliers, items] = await Promise.all([listSuppliers(), listItems()]);

  const supplierOptions: Option[] = suppliers.map((s) => ({
    value: s.id,
    label: s.name ?? s.id
  }));
  const itemOptions: ItemOption[] = items.map((it) => ({
    value: it.id,
    label: it.code ? `${it.code} — ${it.description ?? ""}`.trim() : it.id,
    unit: it.unit
  }));

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / <a href="/po">purchase orders</a> / new
      </div>
      <div className="kicker">fastrak module</div>
      <h1>New purchase order</h1>

      <FormCard>
        <DraftForm draftKey="po:new" action={createPOAction}>
          <Field label="PO number" name="po_no" maxLength={25} autoFocus />
          <DateField label="Date" name="po_date" />
          <SelectField
            label="Supplier"
            name="supplier_id"
            options={supplierOptions}
            placeholder="— select a supplier —"
          />
          <Field label="Remarks" name="remarks" maxLength={150} />
          <POLineEditor items={itemOptions} />
          <FormActions submitLabel="Create purchase order" cancelHref="/po" />
        </DraftForm>
      </FormCard>
    </main>
  );
}
