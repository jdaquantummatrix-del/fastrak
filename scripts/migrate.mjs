// Apply every db/schema/*.sql file to the database, in order.
//
//   • DATABASE_URL set  -> real Postgres (Docker / production).
//   • DATABASE_URL unset -> local PGlite store at ./.pglite (dev).
//
// Schema files use `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`,
// so re-running is safe (idempotent) — there is no migration history table yet.
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("db/schema");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (process.env.DATABASE_URL) {
  const pg = (await import("pg")).default;
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  for (const f of files) {
    await client.query(fs.readFileSync(path.join(dir, f), "utf8"));
    console.log(`applied ${f}`);
  }
  await client.end();
  console.log("schema applied (postgres)");
} else {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = await PGlite.create("./.pglite");
  for (const f of files) {
    await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
    console.log(`applied ${f}`);
  }
  await db.close();
  console.log("schema applied (pglite)");
}
