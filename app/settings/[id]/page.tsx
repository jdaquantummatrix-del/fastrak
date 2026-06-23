import { notFound } from "next/navigation";
import { getSetting } from "@/lib/settings";
import { Field, FormActions, FormCard } from "../../reference-ui";
import { updateSettingAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditSettingPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const setting = await getSetting(decodeURIComponent(id));
  if (!setting) notFound();

  const action = updateSettingAction.bind(null, setting.id);

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> / <a href="/settings">settings</a> / edit
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Edit setting</h1>
      <p className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
        {setting.application ?? setting.id}
      </p>

      <FormCard>
        <form action={action}>
          <Field label="Value" name="value" maxLength={50} defaultValue={setting.value} autoFocus />
          <FormActions submitLabel="Save setting" cancelHref="/settings" />
        </form>
      </FormCard>
    </main>
  );
}
