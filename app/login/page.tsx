import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

// The shared-password login screen (S12 Auth). The middleware redirects every
// unauthenticated request here. Stands alone — no app sidebar. Real per-user
// accounts/roles come later, see docs/adr/0004-auth-model.md.
export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand" style={{ padding: "0 0 18px" }}>
          <div className="brand-mark">f</div>
          <div>
            <div className="brand-name">fastrak</div>
            <div className="brand-sub">Project Kenny</div>
          </div>
        </div>

        <h1 style={{ fontSize: 18 }}>Sign in</h1>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 18 }}>
          Enter your username and password to continue.
        </p>

        {error ? (
          <div
            className="notice notice-error"
            style={{ marginBottom: 14, padding: "10px 12px" }}
          >
            <strong>Wrong username or password.</strong>{" "}
            <span className="muted">Try again.</span>
          </div>
        ) : null}

        <form action={loginAction}>
          <input type="hidden" name="next" value={safeNext} />
          <label className="field-label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            style={{ marginBottom: 14 }}
          />
          <label className="field-label" htmlFor="pw">
            Password
          </label>
          <input
            id="pw"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <button
            className="btn btn-primary"
            type="submit"
            style={{ width: "100%", justifyContent: "center", marginTop: 16 }}
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
