-- Per-user accounts (replaces the single shared password). Mirrors the QMDI
-- auth model: username + scrypt password hash, an admin flag, a sensitive-info
-- flag (can_see_prices), and an active flag so people can be disabled without
-- deletion. Module-level access lives in user_module_grants (0021).
CREATE TABLE IF NOT EXISTS users (
  id             text PRIMARY KEY,                 -- newId() 10-char, like CID
  tenant_id      text NOT NULL DEFAULT 'fastrak',
  username       text NOT NULL,                    -- stored lowercase
  name           text,                             -- display name
  role           text NOT NULL DEFAULT 'staff',    -- preset label (admin/manager/sales/…)
  password_hash  text,                             -- NULL = cannot sign in
  is_admin       boolean NOT NULL DEFAULT false,   -- can manage users + see everything
  can_see_prices boolean NOT NULL DEFAULT false,   -- may view cost/price figures
  is_active      boolean NOT NULL DEFAULT true,    -- false = sign-in refused
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Usernames are unique case-insensitively (we store them lowercased anyway).
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (lower(username));
CREATE INDEX IF NOT EXISTS users_tenant_idx ON users (tenant_id);
