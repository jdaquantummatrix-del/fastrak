import { createItemAction } from "../actions";
import { FormActions, FormCard } from "../../reference-ui";
import { ItemFormFields } from "../item-form";

export const dynamic = "force-dynamic";

export default async function NewItemPage() {
  const fields = await ItemFormFields({});
  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / <a href="/items">items</a> / new
      </div>
      <div className="kicker">fastrak module</div>
      <h1>New item</h1>

      <FormCard>
        <form action={createItemAction}>
          {fields}
          <FormActions submitLabel="Create item" cancelHref="/items" />
        </form>
      </FormCard>
    </main>
  );
}
