import { createUnitAction } from "../actions";
import { Field, FormActions, FormCard } from "../../reference-ui";

export default function NewUnitPage() {
  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / <a href="/units">units</a> / new
      </div>
      <div className="kicker">fastrak reference data</div>
      <h1>New unit</h1>

      <FormCard>
        <form action={createUnitAction}>
          <Field label="Unit" name="unit" required maxLength={10} autoFocus />
          <FormActions submitLabel="Create unit" cancelHref="/units" />
        </form>
      </FormCard>
    </main>
  );
}
