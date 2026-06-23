import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/account";
import { getUserById, getGrants } from "@/lib/users";
import { MODULES, ROLE_PRESETS, type Access } from "@/lib/roles";
import {
  changeRoleAction,
  saveAccessAction,
  setActiveAction,
  resetPasswordAction
} from "../actions";

export const dynamic = "force-dynamic";

const SAVED_MESSAGES: Record<string, string> = {
  role: "Role updated — access was reset to the role's defaults.",
  access: "Access saved.",
  active: "Status updated.",
  password: "Password reset."
};

export default async function EditUserPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { saved, error } = await searchParams;

  const user = await getUserById(id);
  if (!user) notFound();

  const grants = await getGrants(id);
  const accessByModule = new Map<string, Access>(
    grants.map((g) => [g.moduleKey, g.access])
  );

  const groups = [...new Set(MODULES.map((m) => m.group))];

  return (
    <main>
      <div className="crumb">
        <a href="/users">← Manage access</a>
      </div>
      <div className="page-header">
        <div>
          <div className="kicker">Person</div>
          <h1>{user.name || user.username}</h1>
        </div>
        <div className="badge-row">
          <span className="badge">{user.username}</span>
          {user.isActive ? (
            <span className="badge badge-ok">active</span>
          ) : (
            <span className="badge badge-muted">inactive</span>
          )}
        </div>
      </div>

      {saved ? (
        <div className="notice notice-ok" style={{ marginBottom: 16 }}>
          {SAVED_MESSAGES[saved] ?? "Saved."}
        </div>
      ) : null}
      {error ? (
        <div className="notice notice-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      {/* Role */}
      <section className="card" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Role</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Picking a role resets this person&apos;s access to that role&apos;s
          defaults. Fine-tune individual modules below afterwards.
        </p>
        <form action={changeRoleAction} className="inline-form">
          <input type="hidden" name="id" value={user.id} />
          <select name="role" defaultValue={user.role}>
            {ROLE_PRESETS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <button className="btn" type="submit">
            Apply role
          </button>
        </form>
      </section>

      {/* Per-module access */}
      <section className="card" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Module access</h2>
        {user.isAdmin ? (
          <p className="muted" style={{ fontSize: 13 }}>
            This person is an <strong>administrator</strong> — they have full
            access to every module and can manage other people. Change their role
            above to restrict access.
          </p>
        ) : (
          <form action={saveAccessAction}>
            <input type="hidden" name="id" value={user.id} />
            {groups.map((group) => (
              <div key={group} style={{ marginBottom: 14 }}>
                <div className="nav-section" style={{ paddingLeft: 0 }}>
                  {group}
                </div>
                {MODULES.filter((m) => m.group === group).map((m) => {
                  const current = accessByModule.get(m.key) ?? "off";
                  return (
                    <div className="grant-row" key={m.key}>
                      <span>{m.label}</span>
                      <select name={`module_${m.key}`} defaultValue={current}>
                        <option value="off">No access</option>
                        <option value="view">View only</option>
                        <option value="edit">View &amp; edit</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            ))}

            <label
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                margin: "8px 0 16px"
              }}
            >
              <input
                type="checkbox"
                name="can_see_prices"
                value="1"
                defaultChecked={user.canSeePrices}
              />
              <span style={{ fontSize: 14 }}>
                May view cost / price figures
              </span>
            </label>

            <button className="btn btn-primary" type="submit">
              Save access
            </button>
          </form>
        )}
      </section>

      {/* Reset password */}
      <section className="card" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Reset password</h2>
        <form action={resetPasswordAction} className="inline-form">
          <input type="hidden" name="id" value={user.id} />
          <input
            name="password"
            type="text"
            required
            minLength={4}
            placeholder="new password"
          />
          <button className="btn" type="submit">
            Set password
          </button>
        </form>
      </section>

      {/* Activation */}
      <section className="card" style={{ padding: "18px 20px" }}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>
          {user.isActive ? "Deactivate" : "Reactivate"}
        </h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          {user.isActive
            ? "A deactivated person cannot sign in, but their records are kept."
            : "Allow this person to sign in again."}
        </p>
        <form action={setActiveAction}>
          <input type="hidden" name="id" value={user.id} />
          <input type="hidden" name="active" value={user.isActive ? "0" : "1"} />
          <button
            className={user.isActive ? "btn btn-danger" : "btn btn-primary"}
            type="submit"
          >
            {user.isActive ? "Deactivate" : "Reactivate"}
          </button>
        </form>
      </section>
    </main>
  );
}
