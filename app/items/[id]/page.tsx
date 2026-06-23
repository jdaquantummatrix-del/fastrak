import { notFound } from "next/navigation";
import { getItem } from "@/lib/items";
import { updateItemAction } from "../actions";
import { FormActions, FormCard } from "../../reference-ui";
import { ItemFormFields } from "../item-form";

export const dynamic = "force-dynamic";

export default async function EditItemPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();

  const action = updateItemAction.bind(null, item.id);
  const fields = await ItemFormFields({ item });

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / <a href="/items">items</a> / edit
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Edit item</h1>
      <p className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
        {item.id}
      </p>

      <FormCard>
        <form action={action}>
          {fields}
          <FormActions submitLabel="Save changes" cancelHref="/items" />
        </form>
      </FormCard>
    </main>
  );
}
