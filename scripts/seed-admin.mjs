// Ensure a first admin account exists. Idempotent: if a user with the configured
// ADMIN_USERNAME already exists, it is left untouched (so re-running on every
// container boot never clobbers a changed password). Works against Postgres
// (DATABASE_URL set) or the local PGlite store.
//
//   ADMIN_USERNAME  default "admin"
//   ADMIN_PASSWORD  default "changeme"  (change it, or reset from the UI)
//
// Hashing matches lib/password.ts exactly: scrypt, "scrypt$<salt>$<hash>".
import { randomBytes, scryptSync } from "node:crypto";

const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "changeme";

function hashPassword(plain) {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function newId() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 10; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}

async function run(exec) {
  const existing = await exec(`select id from users where lower(username) = $1 limit 1`, [
    username
  ]);
  if (existing.length > 0) {
    console.log(`admin user "${username}" already exists — left untouched`);
    return;
  }
  await exec(
    `insert into users (id, username, name, role, password_hash, is_admin, can_see_prices, is_active)
     values ($1, $2, 'Administrator', 'admin', $3, true, true, true)`,
    [newId(), username, hashPassword(password)]
  );
  console.log(`created admin user "${username}"`);
}

if (process.env.DATABASE_URL) {
  const pg = (await import("pg")).default;
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await run((text, params) => client.query(text, params).then((r) => r.rows));
  await client.end();
} else {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = await PGlite.create("./.pglite");
  await run((text, params = []) => db.query(text, params).then((r) => r.rows));
  await db.close();
}
