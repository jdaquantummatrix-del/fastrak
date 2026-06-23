import { createBrandAction } from "../actions";
import { Field, FormActions, FormCard } from "../../reference-ui";

export default function NewBrandPage() {
  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / <a href="/brands">brands</a> / new
      </div>
      <div className="kicker">fastrak reference data</div>
      <h1>New brand</h1>

      <FormCard>
        <form action={createBrandAction}>
          <Field label="Brand" name="brand" required maxLength={150} autoFocus />
          <Field label="Remarks" name="remarks" maxLength={150} />
          <FormActions submitLabel="Create brand" cancelHref="/brands" />
        </form>
      </FormCard>
    </main>
  );
}
