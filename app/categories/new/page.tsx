import { createCategoryAction } from "../actions";
import { Field, FormActions, FormCard } from "../../reference-ui";

export default function NewCategoryPage() {
  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / <a href="/categories">categories</a> / new
      </div>
      <div className="kicker">fastrak reference data</div>
      <h1>New category</h1>

      <FormCard>
        <form action={createCategoryAction}>
          <Field label="Category" name="category" required maxLength={150} autoFocus />
          <Field label="Remarks" name="remarks" maxLength={150} />
          <FormActions submitLabel="Create category" cancelHref="/categories" />
        </form>
      </FormCard>
    </main>
  );
}
