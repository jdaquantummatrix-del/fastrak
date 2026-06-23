import { notFound } from "next/navigation";
import { getUnit } from "@/lib/units";
import { updateUnitAction } from "../actions";
import { Field, FormActions, FormCard } from "../../reference-ui";

export const dynamic = "force-dynamic";

export default async function EditUnitPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const unit = await getUnit(id);
  if (!unit) notFound();

  const action = updateUnitAction.bind(null, unit.id);

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / <a href="/units">units</a> / edit
      </div>
      <div className="kicker">fastrak reference data</div>
      <h1>Edit unit</h1>
      <p className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
        {unit.id}
      </p>

      <FormCard>
        <form action={action}>
          <Field
            label="Unit"
            name="unit"
            required
            maxLength={10}
            defaultValue={unit.unit}
            autoFocus
          />
          <FormActions submitLabel="Save changes" cancelHref="/units" />
        </form>
      </FormCard>
    </main>
  );
}
