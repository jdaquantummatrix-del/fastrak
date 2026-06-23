// Record a single stock movement: pick the item, enter units in/out, label it
// with a reference, and tag the source-document type. Server component; submits
// to recordMovementAction.
import { listItems } from "@/lib/items";
import { recordMovementAction } from "../actions";
import { Field, FormActions, FormCard } from "../../reference-ui";
import { SelectField, DateField, type Option } from "../movement-ui";

export const dynamic = "force-dynamic";

export default async function NewMovementPage() {
  const items = await listItems();
  const itemOptions: Option[] = items.map((it) => ({
    value: it.id,
    label: it.code ? `${it.code} — ${it.description ?? ""}`.trim() : it.id
  }));

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> /{" "}
        <a href="/inventory">inventory</a> / new movement
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Record movement</h1>

      <FormCard>
        <form action={recordMovementAction}>
          <SelectField
            label="Item"
            name="itemId"
            options={itemOptions}
            placeholder="— select an item —"
            required
          />
          <Field label="Units in" name="in" type="number" />
          <Field label="Units out" name="out" type="number" />
          <DateField label="Date" name="date" />
          <Field label="Reference no." name="refNo" maxLength={150} />
          <Field label="Label" name="name" maxLength={150} />
          <SelectField
            label="Source document"
            name="refType"
            placeholder="— none —"
            options={[
              { value: "po", label: "Purchase Order" },
              { value: "dr", label: "Delivery Receipt" },
              { value: "dscrp", label: "Discrepancy" },
              { value: "return", label: "Return" }
            ]}
          />
          <Field label="Source document id" name="refId" maxLength={10} />
          <FormActions submitLabel="Record movement" cancelHref="/inventory" />
        </form>
      </FormCard>
    </main>
  );
}
