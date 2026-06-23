import { notFound } from "next/navigation";
import { getSupplier } from "@/lib/suppliers";
import { updateSupplierAction } from "../actions";
import { Field, CheckboxField, FormActions, FormCard } from "../../reference-ui";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) notFound();

  const action = updateSupplierAction.bind(null, supplier.id);

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / <a href="/suppliers">suppliers</a> / edit
      </div>
      <div className="kicker">fastrak reference data</div>
      <h1>Edit supplier</h1>
      <p className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
        {supplier.id}
      </p>

      <FormCard>
        <form action={action}>
          <Field
            label="Name"
            name="name"
            required
            maxLength={150}
            defaultValue={supplier.name}
            autoFocus
          />
          <Field
            label="Terms (days)"
            name="terms_days"
            type="number"
            defaultValue={supplier.terms_days}
          />
          <Field
            label="Contact person"
            name="contact_person"
            maxLength={100}
            defaultValue={supplier.contact_person}
          />
          <Field label="Tel no" name="tel_no" maxLength={50} defaultValue={supplier.tel_no} />
          <Field label="Fax no" name="fax_no" maxLength={50} defaultValue={supplier.fax_no} />
          <Field
            label="Address"
            name="address"
            maxLength={150}
            defaultValue={supplier.address}
          />
          <CheckboxField
            label="Local supplier"
            name="is_local"
            defaultChecked={supplier.is_local ?? false}
          />
          <Field
            label="Remarks"
            name="remarks"
            maxLength={150}
            defaultValue={supplier.remarks}
          />
          <FormActions submitLabel="Save changes" cancelHref="/suppliers" />
        </form>
      </FormCard>
    </main>
  );
}
