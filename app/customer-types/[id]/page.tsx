import { notFound } from "next/navigation";
import { getCustomerType } from "@/lib/customer-types";
import { updateCustomerTypeAction, deleteCustomerTypeAction } from "../actions";
import { Field, FormActions, FormCard } from "../../reference-ui";

export const dynamic = "force-dynamic";

export default async function EditCustomerTypePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const type = await getCustomerType(id);
  if (!type) notFound();

  const action = updateCustomerTypeAction.bind(null, type.id);
  const remove = deleteCustomerTypeAction.bind(null, type.id);

  return (
    <main>
      <div className="crumb">
        <a href="/">← fastrak</a> /{" "}
        <a href="/customer-types">customer types</a> / edit
      </div>
      <div className="kicker">fastrak reference data</div>
      <h1>Edit customer type</h1>
      <p className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
        {type.id}
      </p>

      <FormCard>
        <form action={action}>
          <Field
            label="Type"
            name="name"
            required
            maxLength={50}
            defaultValue={type.name}
            autoFocus
          />
          <Field
            label="Remarks"
            name="remarks"
            maxLength={150}
            defaultValue={type.remarks}
          />
          <FormActions submitLabel="Save changes" cancelHref="/customer-types" />
        </form>
      </FormCard>

      <form action={remove} style={{ marginTop: 16 }}>
        <button type="submit" className="tag" style={{ color: "#f0a3a3" }}>
          remove this type
        </button>
      </form>
    </main>
  );
}
