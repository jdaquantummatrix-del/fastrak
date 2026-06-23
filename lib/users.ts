// Data layer for per-user accounts, module grants and the login audit. Raw SQL
// over the shared Db (same style as the other lib/* modules). Password hashing
// lives in lib/password.ts; role presets in lib/roles.ts.
import { appDb } from "./db";
import type { Db } from "./db";
import type { Executor } from "./reference";
import { newId, clean, defaultExecutor } from "./reference";
import { hashPassword } from "./password";
import { type Access, MODULE_KEYS, rolePreset } from "./roles";

export type Account = {
  id: string;
  username: string;
  name: string | null;
  role: string;
  isAdmin: boolean;
  canSeePrices: boolean;
  isActive: boolean;
};
export type AccountWithHash = Account & { passwordHash: string | null };
export type Grant = { moduleKey: string; access: Exclude<Access, "off"> };

const COLS =
  "id, username, name, role, is_admin, can_see_prices, is_active";

function mapAccount(r: Record<string, unknown>): Account {
  return {
    id: String(r.id),
    username: String(r.username),
    name: (r.name as string | null) ?? null,
    role: String(r.role),
    isAdmin: Boolean(r.is_admin),
    canSeePrices: Boolean(r.can_see_prices),
    isActive: Boolean(r.is_active)
  };
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getUserByUsername(
  username: string,
  exec: Executor = defaultExecutor
): Promise<AccountWithHash | null> {
  const u = clean(username)?.toLowerCase();
  if (!u) return null;
  const rows = await exec(
    `select ${COLS}, password_hash from users where lower(username) = $1 limit 1`,
    [u]
  );
  if (!rows[0]) return null;
  return { ...mapAccount(rows[0]), passwordHash: (rows[0].password_hash as string | null) ?? null };
}

export async function getUserById(
  id: string,
  exec: Executor = defaultExecutor
): Promise<Account | null> {
  const rows = await exec(`select ${COLS} from users where id = $1 limit 1`, [id]);
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function listUsers(exec: Executor = defaultExecutor): Promise<Account[]> {
  const rows = await exec(
    `select ${COLS} from users order by is_active desc, lower(username)`
  );
  return rows.map(mapAccount);
}

export async function getGrants(
  userId: string,
  exec: Executor = defaultExecutor
): Promise<Grant[]> {
  const rows = await exec(
    `select module_key, can_edit from user_module_grants where user_id = $1`,
    [userId]
  );
  return rows.map((r) => ({
    moduleKey: String(r.module_key),
    access: r.can_edit ? "edit" : "view"
  }));
}

// The set of module keys this account may reach. Admins reach everything.
export async function allowedModuleKeys(
  account: Account,
  exec: Executor = defaultExecutor
): Promise<Set<string>> {
  if (account.isAdmin) return new Set(MODULE_KEYS);
  const grants = await getGrants(account.id, exec);
  return new Set(grants.map((g) => g.moduleKey));
}

export async function countActiveAdmins(
  exec: Executor = defaultExecutor
): Promise<number> {
  const rows = await exec(
    `select count(*)::int as n from users where is_admin = true and is_active = true`
  );
  return Number(rows[0]?.n ?? 0);
}

export async function hasAnyUser(exec: Executor = defaultExecutor): Promise<boolean> {
  const rows = await exec(`select count(*)::int as n from users`);
  return Number(rows[0]?.n ?? 0) > 0;
}

// ── Writes ───────────────────────────────────────────────────────────────────

// Replace a user's flags + module grants with a role preset (inside a tx).
async function applyPreset(exec: Executor, userId: string, roleKey: string) {
  const preset = rolePreset(roleKey);
  if (!preset) throw new Error(`Unknown role: ${roleKey}`);
  await exec(
    `update users set role = $2, is_admin = $3, can_see_prices = $4 where id = $1`,
    [userId, preset.key, preset.isAdmin, preset.canSeePrices]
  );
  await exec(`delete from user_module_grants where user_id = $1`, [userId]);
  for (const [moduleKey, access] of Object.entries(preset.grants)) {
    if (access === "off") continue;
    await exec(
      `insert into user_module_grants (id, user_id, module_key, can_edit)
       values ($1, $2, $3, $4)`,
      [newId(), userId, moduleKey, access === "edit"]
    );
  }
}

export async function createUser(
  input: { username: string; name?: string | null; role: string; password: string },
  db: Db = appDb
): Promise<Account> {
  const username = clean(input.username)?.toLowerCase();
  if (!username) throw new Error("Username is required");
  if (/\s/.test(username)) throw new Error("Username cannot contain spaces");
  const password = input.password ?? "";
  if (password.length < 4) throw new Error("Password must be at least 4 characters");
  if (!rolePreset(input.role)) throw new Error(`Unknown role: ${input.role}`);

  const id = newId();
  return db.transaction(async (exec) => {
    // Uniqueness checked inside the tx so the check and the insert see the same
    // state (the lower(username) unique index is the real backstop).
    const existing = await getUserByUsername(username, exec);
    if (existing) throw new Error(`Username "${username}" is already taken`);
    await exec(
      `insert into users (id, username, name, role, password_hash, is_admin, can_see_prices, is_active)
       values ($1, $2, $3, $4, $5, false, false, true)`,
      [id, username, clean(input.name ?? null), input.role, hashPassword(password)]
    );
    await applyPreset(exec, id, input.role);
    const rows = await exec(`select ${COLS} from users where id = $1`, [id]);
    return mapAccount(rows[0]);
  });
}

export async function setRole(userId: string, roleKey: string, db: Db = appDb) {
  const preset = rolePreset(roleKey);
  if (!preset) throw new Error(`Unknown role: ${roleKey}`);
  await db.transaction(async (exec) => {
    // Guard: don't let the last active admin be demoted out of admin.
    const target = await getUserById(userId, exec);
    if (!target) throw new Error("User not found");
    if (target.isAdmin && !preset.isAdmin && (await countActiveAdmins(exec)) <= 1) {
      throw new Error("Cannot remove admin from the last active administrator");
    }
    await applyPreset(exec, userId, roleKey);
  });
}

export async function setActive(
  userId: string,
  active: boolean,
  exec: Executor = defaultExecutor
) {
  const target = await getUserById(userId, exec);
  if (!target) throw new Error("User not found");
  if (!active && target.isAdmin && (await countActiveAdmins(exec)) <= 1) {
    throw new Error("Cannot deactivate the last active administrator");
  }
  await exec(`update users set is_active = $2 where id = $1`, [userId, active]);
}

export async function setCanSeePrices(
  userId: string,
  value: boolean,
  exec: Executor = defaultExecutor
) {
  await exec(`update users set can_see_prices = $2 where id = $1`, [userId, value]);
}

export async function setGrant(
  userId: string,
  moduleKey: string,
  access: Access,
  exec: Executor = defaultExecutor
) {
  if (!MODULE_KEYS.includes(moduleKey)) throw new Error(`Unknown module: ${moduleKey}`);
  if (access === "off") {
    await exec(`delete from user_module_grants where user_id = $1 and module_key = $2`, [
      userId,
      moduleKey
    ]);
    return;
  }
  await exec(
    `insert into user_module_grants (id, user_id, module_key, can_edit)
     values ($1, $2, $3, $4)
     on conflict (user_id, module_key) do update set can_edit = excluded.can_edit`,
    [newId(), userId, moduleKey, access === "edit"]
  );
}

export async function resetPassword(
  userId: string,
  plain: string,
  exec: Executor = defaultExecutor
) {
  if (!plain || plain.length < 4) throw new Error("Password must be at least 4 characters");
  await exec(`update users set password_hash = $2 where id = $1`, [
    userId,
    hashPassword(plain)
  ]);
}

export async function recordLogin(
  userId: string,
  exec: Executor = defaultExecutor
): Promise<void> {
  try {
    await exec(`insert into login_audit (user_id) values ($1)`, [userId]);
  } catch {
    // Auditing must never block a successful login.
  }
}
