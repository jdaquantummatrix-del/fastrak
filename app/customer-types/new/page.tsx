import { createCustomerTypeAction } from "../actions";
import { Field, FormActions, FormCard } from "../../reference-ui";

export default function NewCustomerTypePage() {
  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> /{" "}
        <a href="/customer-types">customer types</a> / new
      </div>
      <div className="kicker">fastrak reference data</div>
      <h1>New customer type</h1>

      <FormCard>
        <form action={createCustomerTypeAction}>
          <Field label="Type" name="name" required maxLength={50} autoFocus />
          <Field label="Remarks" name="remarks" maxLength={150} />
          <FormActions submitLabel="Create type" cancelHref="/customer-types" />
        </form>
      </FormCard>
    </main>
  );
}
