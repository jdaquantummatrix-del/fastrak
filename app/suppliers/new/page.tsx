import { createSupplierAction } from "../actions";
import { Field, CheckboxField, FormActions, FormCard } from "../../reference-ui";

export default function NewSupplierPage() {
  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / <a href="/suppliers">suppliers</a> / new
      </div>
      <div className="kicker">fastrak reference data</div>
      <h1>New supplier</h1>

      <FormCard>
        <form action={createSupplierAction}>
          <Field label="Name" name="name" required maxLength={150} autoFocus />
          <Field label="Terms (days)" name="terms_days" type="number" />
          <Field label="Contact person" name="contact_person" maxLength={100} />
          <Field label="Tel no" name="tel_no" maxLength={50} />
          <Field label="Fax no" name="fax_no" maxLength={50} />
          <Field label="Address" name="address" maxLength={150} />
          <CheckboxField label="Local supplier" name="is_local" />
          <Field label="Remarks" name="remarks" maxLength={150} />
          <FormActions submitLabel="Create supplier" cancelHref="/suppliers" />
        </form>
      </FormCard>
    </main>
  );
}
