import { createCustomerAction } from "../actions";
import { Field, SelectField, FormActions, FormCard } from "../../reference-ui";
import { listCustomerTypes } from "@/lib/customer-types";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  const types = await listCustomerTypes();
  const typeOptions = types.map((t) => ({ value: t.name ?? "", label: t.name ?? "—" }));
  return (
    <main>
      <div className="crumb">
        <a href="/">← fastrak</a> / <a href="/customers">customers</a> / new
      </div>
      <div className="kicker">fastrak module</div>
      <h1>New customer</h1>

      <FormCard>
        <form action={createCustomerAction}>
          <Field label="Name" name="name" required maxLength={150} autoFocus />
          <SelectField
            label="Type"
            name="type"
            options={typeOptions}
            placeholder="— select a type —"
          />
          <Field label="Terms (days)" name="terms_days" type="number" />
          <Field label="Address" name="address" maxLength={150} />
          <Field label="Contact person" name="contact_person" maxLength={100} />
          <Field label="Mobile" name="mobile" maxLength={15} />
          <Field label="Tel no" name="tel_no" maxLength={25} />
          <Field label="Fax no" name="fax_no" maxLength={15} />
          <Field label="TIN" name="tin" maxLength={25} />
          <Field label="Remarks" name="remarks" maxLength={150} />
          <FormActions submitLabel="Create customer" cancelHref="/customers" />
        </form>
      </FormCard>
    </main>
  );
}
