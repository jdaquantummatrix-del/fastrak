-- Per-module access for a user. One row per module the user can reach.
--   no row        -> no access (the module is hidden)
--   can_edit=false -> view-only
--   can_edit=true  -> view + edit
-- Admins (users.is_admin) bypass this and reach everything.
CREATE TABLE IF NOT EXISTS user_module_grants (
  id          text PRIMARY KEY,                    -- newId()
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_key  text NOT NULL,                       -- e.g. 'dr', 'inventory', 'reports'
  can_edit    boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, module_key)
);

CREATE INDEX IF NOT EXISTS user_module_grants_user_idx ON user_module_grants (user_id);
