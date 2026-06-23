import { notFound } from "next/navigation";
import { getBrand } from "@/lib/brands";
import { updateBrandAction } from "../actions";
import { Field, FormActions, FormCard } from "../../reference-ui";

export const dynamic = "force-dynamic";

export default async function EditBrandPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brand = await getBrand(id);
  if (!brand) notFound();

  const action = updateBrandAction.bind(null, brand.id);

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / <a href="/brands">brands</a> / edit
      </div>
      <div className="kicker">fastrak reference data</div>
      <h1>Edit brand</h1>
      <p className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
        {brand.id}
      </p>

      <FormCard>
        <form action={action}>
          <Field
            label="Brand"
            name="brand"
            required
            maxLength={150}
            defaultValue={brand.brand}
            autoFocus
          />
          <Field
            label="Remarks"
            name="remarks"
            maxLength={150}
            defaultValue={brand.remarks}
          />
          <FormActions submitLabel="Save changes" cancelHref="/brands" />
        </form>
      </FormCard>
    </main>
  );
}
