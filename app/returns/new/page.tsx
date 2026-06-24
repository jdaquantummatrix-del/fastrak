// Create a Return: pick the customer, date and (optionally) the original Delivery
// Receipt, then add one or more returned-item lines (item picker + qty + price +
// discounts + unit + a "Good" / resalable flag). Submits to createReturnAction.
// Server component; the dynamic line rows live in the ReturnLineEditor client
// component. The customer / DR pickers and date input reuse the inventory slice's
// SelectField / DateField.
import { listCustomers } from "@/lib/customers";
import { listItems } from "@/lib/items";
import { listDRs } from "@/lib/dr";
import { createReturnAction } from "../actions";
import { Field, FormActions, FormCard } from "../../reference-ui";
import { SelectField, DateField, type Option } from "../../inventory/movement-ui";
import { ReturnLineEditor, type ReturnItemOption } from "../return-lines";
import { DraftForm } from "../../_components/draft-form";

export const dynamic = "force-dynamic";

export default async function NewReturnPage() {
  const [customers, items, drs] = await Promise.all([
    listCustomers(),
    listItems(),
    listDRs()
  ]);

  const customerOptions: Option[] = customers.map((c) => ({
    value: c.id,
    label: c.name ?? c.id
  }));
  const drOptions: Option[] = drs.map((dr) => ({
    value: dr.id,
    label: `${dr.dr_no ?? dr.id}${dr.dr_date ? ` — ${dr.dr_date}` : ""}`
  }));
  const itemOptions: ReturnItemOption[] = items.map((it) => ({
    value: it.id,
    label: it.code ? `${it.code} — ${it.description ?? ""}`.trim() : it.id,
    unit: it.unit,
    price: it.price
  }));

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / <a href="/returns">returns</a> / new
      </div>
      <div className="kicker">fastrak module</div>
      <h1>New return</h1>

      <FormCard>
        <DraftForm draftKey="return:new" action={createReturnAction}>
          <DateField label="Date" name="return_date" />
          <SelectField
            label="Customer"
            name="customer_id"
            options={customerOptions}
            placeholder="— select a customer —"
          />
          <SelectField
            label="Original delivery receipt (optional)"
            name="dr_id"
            options={drOptions}
            placeholder="— none —"
          />
          <Field label="Remarks" name="remarks" maxLength={150} />
          <ReturnLineEditor items={itemOptions} />
          <FormActions submitLabel="Create return" cancelHref="/returns" />
        </DraftForm>
      </FormCard>
    </main>
  );
}
