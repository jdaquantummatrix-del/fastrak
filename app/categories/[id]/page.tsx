import { notFound } from "next/navigation";
import { getCategory } from "@/lib/categories";
import { updateCategoryAction } from "../actions";
import { Field, FormActions, FormCard } from "../../reference-ui";

export const dynamic = "force-dynamic";

export default async function EditCategoryPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await getCategory(id);
  if (!category) notFound();

  const action = updateCategoryAction.bind(null, category.id);

  return (
    <main>
      <div className="crumb">
        <a href="/">← fastrak</a> / <a href="/categories">categories</a> / edit
      </div>
      <div className="kicker">fastrak reference data</div>
      <h1>Edit category</h1>
      <p className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
        {category.id}
      </p>

      <FormCard>
        <form action={action}>
          <Field
            label="Category"
            name="category"
            required
            maxLength={150}
            defaultValue={category.category}
            autoFocus
          />
          <Field
            label="Remarks"
            name="remarks"
            maxLength={150}
            defaultValue={category.remarks}
          />
          <FormActions submitLabel="Save changes" cancelHref="/categories" />
        </form>
      </FormCard>
    </main>
  );
}
