import { getCompany, type Company } from "@/lib/company";
import { listSettings, type Setting } from "@/lib/settings";
import { Field, FormActions, FormCard } from "../reference-ui";
import { saveCompanyAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let company: Company | null = null;
  let settings: Setting[] = [];
  let error: string | null = null;
  try {
    [company, settings] = await Promise.all([getCompany(), listSettings()]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main>
      <div className="crumb">
        <a href="/">← fastrak</a> / settings
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Company &amp; settings</h1>

      {error ? (
        <div className="card" style={{ padding: "18px 20px" }}>
          <strong style={{ color: "#f0a3a3" }}>Database not reachable.</strong>
          <p className="muted" style={{ marginBottom: 6 }}>
            Start it and load the data with: <code>npm run db:setup</code>
          </p>
          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
            ({error})
          </p>
        </div>
      ) : (
        <>
          <div className="badge-row">
            <span className="tag">source: company.dbf</span>
            <span className="tag">source: appdflt.dbf</span>
          </div>

          <h2 style={{ fontSize: 18, marginTop: 24 }}>Company information</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            Your business&apos;s own details — used for document and report headers.
          </p>
          <FormCard>
            <form action={saveCompanyAction}>
              <Field
                label="Company name"
                name="name"
                required
                maxLength={150}
                defaultValue={company?.name}
                autoFocus
              />
              <Field
                label="Address"
                name="address"
                maxLength={200}
                defaultValue={company?.address}
              />
              <Field
                label="Proprietor"
                name="proprietor"
                maxLength={100}
                defaultValue={company?.proprietor}
              />
              <Field label="TIN" name="tin" maxLength={25} defaultValue={company?.tin} />
              <Field
                label="Tel no"
                name="tel_no"
                maxLength={50}
                defaultValue={company?.tel_no}
              />
              <Field
                label="Fax no"
                name="fax_no"
                maxLength={50}
                defaultValue={company?.fax_no}
              />
              <FormActions submitLabel="Save company" cancelHref="/settings" />
            </form>
          </FormCard>

          <h2 style={{ fontSize: 18, marginTop: 32 }}>Application defaults</h2>
          <div className="badge-row">
            <span className="count">{settings.length} setting(s)</span>
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Type</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {settings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      No settings yet — run <code>npm run db:import</code>.
                    </td>
                  </tr>
                ) : (
                  settings.map((s) => (
                    <tr key={s.id}>
                      <td>{s.application ?? "—"}</td>
                      <td>{s.value ?? "—"}</td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                        {s.data_type ?? "—"}
                      </td>
                      <td>
                        <a href={`/settings/${encodeURIComponent(s.id)}`}>edit</a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
