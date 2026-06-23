import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { Db } from "./db";
import type { Executor } from "./reference";

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

// Wrap a test PGlite as a `Db` so transactional data-module code (createPO,
// receivePO, the DR ops) can run against the in-memory DB. `transaction` maps
// PGlite's tx.query -> { rows } onto the Executor shape, exactly like appDb.
export function asDb(pg: PGlite): Db {
  return {
    query: (text, params) =>
      pg.query(text, params).then((r) => r.rows as Record<string, unknown>[]),
    transaction: (fn) =>
      pg.transaction(async (tx) => {
        const exec: Executor = (text, params) =>
          tx.query(text, params).then((r) => r.rows as Record<string, unknown>[]);
        return fn(exec);
      })
  };
}
