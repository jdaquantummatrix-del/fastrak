import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

// A fresh in-memory database with the full schema applied — for tests.
// Applies every db/schema/*.sql file in order, so each slice's table is present.
export async function createTestDb(): Promise<PGlite> {
  const db = await PGlite.create(); // no path => ephemeral, in-memory
  const dir = path.join(process.cwd(), "db", "schema");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  }
  return db;
}
