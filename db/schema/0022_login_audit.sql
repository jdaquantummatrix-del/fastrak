-- Append-only record of successful logins (who signed in, and when). Useful for
-- a basic audit trail; never blocks login if the insert fails.
CREATE TABLE IF NOT EXISTS login_audit (
  id       bigserial PRIMARY KEY,
  user_id  text NOT NULL REFERENCES users(id),
  at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_audit_user_idx ON login_audit (user_id, at DESC);
