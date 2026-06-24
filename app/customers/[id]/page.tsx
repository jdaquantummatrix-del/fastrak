import { notFound } from "next/navigation";
import { getCustomer } from "@/lib/customers";
import { listCustomerTypes } from "@/lib/customer-types";
import { updateCustomerAction } from "../actions";
import { Field, SelectField, FormActions, FormCard } from "../../reference-ui";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const types = await listCustomerTypes();
  const typeOptions = types.map((t) => ({ value: t.name ?? "", label: t.name ?? "—" }));
  // Preserve a legacy free-text type that isn't in the managed list, so saving
  // an existing customer never silently drops its current Type.
  if (customer.type && !typeOptions.some((o) => o.value === customer.type)) {
    typeOptions.push({ value: customer.type, label: `${customer.type} (legacy)` });
  }

  const action = updateCustomerAction.bind(null, customer.id);

  return (
    <main>
      <div className="crumb">
        <a href="/">← fastrak</a> / <a href="/customers">customers</a> / edit
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Edit customer</h1>
      <p className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
        {customer.id}
      </p>

      <FormCard>
        <form action={action}>
          <Field
            label="Name"
            name="name"
            required
            maxLength={150}
            defaultValue={customer.name}
            autoFocus
          />
          <SelectField
            label="Type"
            name="type"
            options={typeOptions}
            defaultValue={customer.type}
            placeholder="— select a type —"
          />
          <Field
            label="Terms (days)"
            name="terms_days"
            type="number"
            defaultValue={customer.terms_days}
          />
          <Field
            label="Address"
            name="address"
            maxLength={150}
            defaultValue={customer.address}
          />
          <Field
            label="Contact person"
            name="contact_person"
            maxLength={100}
            defaultValue={customer.contact_person}
          />
          <Field
            label="Mobile"
            name="mobile"
            maxLength={15}
            defaultValue={customer.mobile}
          />
          <Field label="Tel no" name="tel_no" maxLength={25} defaultValue={customer.tel_no} />
          <Field label="Fax no" name="fax_no" maxLength={15} defaultValue={customer.fax_no} />
          <Field label="TIN" name="tin" maxLength={25} defaultValue={customer.tin} />
          <Field
            label="Remarks"
            name="remarks"
            maxLength={150}
            defaultValue={customer.remarks}
          />
          <FormActions submitLabel="Save changes" cancelHref="/customers" />
        </form>
      </FormCard>
    </main>
  );
}
