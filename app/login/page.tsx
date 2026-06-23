import { loginAction } from "./actions";
import { FormCard, FormActions } from "../reference-ui";

export const dynamic = "force-dynamic";

// The shared-password login screen (S12 Auth). One password field; the
// middleware redirects every unauthenticated request here. This is the minimal
// "simple login now" gate — real per-user accounts/roles come later, see
// docs/adr/0004-auth-model.md.
export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <main>
      <div className="kicker">Project Kenny</div>
      <h1>Sign in</h1>
      <p className="muted">
        This app is protected by a shared password. Enter it to continue.
      </p>

      {error ? (
        <div
          className="card"
          style={{ padding: "12px 16px", borderColor: "#5b2b2b" }}
        >
          <strong style={{ color: "#f0a3a3" }}>Incorrect password.</strong>{" "}
          <span className="muted">Try again.</span>
        </div>
      ) : null}

      <FormCard>
        <form action={loginAction}>
          {/* Carry the originally-requested path through the login round-trip. */}
          <input type="hidden" name="next" value={safeNext} />
          <label style={{ display: "block", marginBottom: 16 }}>
            <span
              style={{
                display: "block",
                fontFamily: "var(--mono)",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--muted)",
                marginBottom: 6
              }}
            >
              Password
            </span>
            <input
              style={{
                width: "100%",
                background: "var(--panel2)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                color: "var(--ink)",
                font: "inherit",
                fontSize: 14,
                padding: "9px 11px"
              }}
              name="password"
              type="password"
              autoFocus
              autoComplete="current-password"
              required
            />
          </label>
          <FormActions submitLabel="Sign in" cancelHref="/login" />
        </form>
      </FormCard>
    </main>
  );
}
