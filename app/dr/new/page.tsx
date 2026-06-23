// Create a Delivery Receipt: pick the customer and date, set terms / discounts /
// add-on, then add one or more line items (item picker + qty + pcs + price +
// discounts). Submits to createDRAction. Server component; the dynamic line rows
// live in the DRLineEditor client component. The customer picker and date input
// reuse the inventory slice's SelectField / DateField.
import { listCustomers } from "@/lib/customers";
import { listItems } from "@/lib/items";
import { createDRAction } from "../actions";
import { Field, FormActions, FormCard } from "../../reference-ui";
import { SelectField, DateField, type Option } from "../../inventory/movement-ui";
import { DRLineEditor, type DRItemOption } from "../dr-lines";

export const dynamic = "force-dynamic";

export default async function NewDRPage() {
  const [customers, items] = await Promise.all([listCustomers(), listItems()]);

  const customerOptions: Option[] = customers.map((c) => ({
    value: c.id,
    label: c.name ?? c.id
  }));
  const itemOptions: DRItemOption[] = items.map((it) => ({
    value: it.id,
    label: it.code ? `${it.code} — ${it.description ?? ""}`.trim() : it.id,
    unit: it.unit,
    price: it.price,
    pack: it.pack_size
  }));

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> /{" "}
        <a href="/dr">delivery receipts</a> / new
      </div>
      <div className="kicker">fastrak module</div>
      <h1>New delivery receipt</h1>

      <FormCard>
        <form action={createDRAction}>
          <Field label="DR number" name="dr_no" maxLength={25} autoFocus />
          <DateField label="Date" name="dr_date" />
          <SelectField
            label="Customer"
            name="customer_id"
            options={customerOptions}
            placeholder="— select a customer —"
          />
          <Field label="Ship-to address" name="address" maxLength={200} />
          <Field label="Customer PO no." name="po_no" maxLength={25} />
          <Field label="Terms (days)" name="terms_days" type="number" />
          <Field label="Document discount %" name="doc_disc" type="number" />
          <Field label="Add-on %" name="add_pct" type="number" />
          <Field label="Remarks" name="remarks" maxLength={150} />
          <DRLineEditor items={itemOptions} />
          <FormActions submitLabel="Create delivery receipt" cancelHref="/dr" />
        </form>
      </FormCard>
    </main>
  );
}
