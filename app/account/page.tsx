import { requireAccount } from "@/lib/account";
import { rolePreset } from "@/lib/roles";
import { changeMyPasswordAction } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  current: "Your current password is incorrect.",
  short: "The new password must be at least 4 characters.",
  match: "The new password and confirmation do not match."
};

// Any signed-in user's own profile + password change.
export default async function AccountPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const me = await requireAccount();
  const { saved, error } = await searchParams;
  const roleLabel = rolePreset(me.role)?.label ?? me.role;

  return (
    <main>
      <div className="page-header">
        <div>
          <div className="kicker">Account</div>
          <h1>My account</h1>
        </div>
      </div>

      <div className="card" style={{ padding: "18px 20px", marginBottom: 20, maxWidth: 560 }}>
        <dl className="kv">
          <dt>Username</dt>
          <dd>{me.username}</dd>
          <dt>Name</dt>
          <dd>{me.name || <span className="muted">—</span>}</dd>
          <dt>Role</dt>
          <dd>
            <span className="badge">{roleLabel}</span>
            {me.isAdmin ? (
              <span className="badge badge-accent" style={{ marginLeft: 6 }}>
                admin
              </span>
            ) : null}
          </dd>
        </dl>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Change password</h2>

      {saved ? (
        <div className="notice notice-ok" style={{ marginBottom: 16, maxWidth: 560 }}>
          Password changed.
        </div>
      ) : null}
      {error ? (
        <div className="notice notice-error" style={{ marginBottom: 16, maxWidth: 560 }}>
          {ERRORS[error] ?? "Could not change password."}
        </div>
      ) : null}

      <div className="card" style={{ padding: "18px 20px", maxWidth: 560 }}>
        <form action={changeMyPasswordAction} className="stack">
          <label className="field">
            <span className="field-label">Current password</span>
            <input name="current" type="password" required autoComplete="current-password" />
          </label>
          <label className="field">
            <span className="field-label">New password</span>
            <input
              name="next"
              type="password"
              required
              minLength={4}
              autoComplete="new-password"
            />
          </label>
          <label className="field">
            <span className="field-label">Confirm new password</span>
            <input
              name="confirm"
              type="password"
              required
              minLength={4}
              autoComplete="new-password"
            />
          </label>
          <div>
            <button className="btn btn-primary" type="submit">
              Change password
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
