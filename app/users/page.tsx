import { requireAdmin } from "@/lib/account";
import { listUsers } from "@/lib/users";
import { ROLE_PRESETS } from "@/lib/roles";
import { createPersonAction } from "./actions";

export const dynamic = "force-dynamic";

// Admin-only "Manage access": list people, add a new one. Per-person editing
// (role, module grants, password, activation) lives at /users/[id].
export default async function UsersPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;
  const users = await listUsers();

  return (
    <main>
      <div className="page-header">
        <div>
          <div className="kicker">Setup</div>
          <h1>Manage access</h1>
        </div>
      </div>

      <p className="muted" style={{ marginTop: -6, maxWidth: 640 }}>
        Each person signs in with their own username and password. A role is a
        starting set of permissions — you can fine-tune any individual&apos;s
        access afterwards.
      </p>

      {error ? (
        <div className="notice notice-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 24 }}>
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No people yet.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.username}</td>
                  <td>{u.name || <span className="muted">—</span>}</td>
                  <td>
                    <span className="badge">{u.role}</span>
                    {u.isAdmin ? (
                      <span className="badge badge-accent" style={{ marginLeft: 6 }}>
                        admin
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {u.isActive ? (
                      <span className="badge badge-ok">active</span>
                    ) : (
                      <span className="badge badge-muted">inactive</span>
                    )}
                  </td>
                  <td>
                    <a href={`/users/${encodeURIComponent(u.id)}`}>Edit</a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Add a person</h2>
      <div className="card" style={{ padding: "18px 20px", maxWidth: 560 }}>
        <form action={createPersonAction} className="stack">
          <div className="form-row">
            <label className="field">
              <span className="field-label">Username</span>
              <input
                name="username"
                type="text"
                required
                autoCapitalize="none"
                spellCheck={false}
                placeholder="e.g. maria"
              />
            </label>
            <label className="field">
              <span className="field-label">Full name</span>
              <input name="name" type="text" placeholder="Maria Santos" />
            </label>
          </div>
          <div className="form-row">
            <label className="field">
              <span className="field-label">Role</span>
              <select name="role" defaultValue="sales">
                {ROLE_PRESETS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Initial password</span>
              <input
                name="password"
                type="text"
                required
                minLength={4}
                placeholder="at least 4 characters"
              />
            </label>
          </div>
          <div>
            <button className="btn btn-primary" type="submit">
              Add person
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
