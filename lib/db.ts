import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { Executor } from "./reference";

// Local dev database: PGlite (Postgres compiled to WASM, runs in-process,
// persisted to ./.pglite). Production uses real Postgres (docker-compose.yml) —
// same SQL, so app code is identical. One instance is reused across hot reloads.
const g = globalThis as unknown as { __pgdb?: Promise<PGlite> };

function getDb(): Promise<PGlite> {
  if (!g.__pgdb) g.__pgdb = PGlite.create(path.join(process.cwd(), ".pglite"));
  return g.__pgdb;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const db = await getDb();
  const res = await db.query<T>(text, params);
  return res.rows;
}

// A database handle for data modules: a plain `query` runner (for reads and
// single statements) PLUS a `transaction` that runs a function with a
// transaction-scoped Executor — every statement inside it commits or rolls back
// as one unit. Multi-step posting (header + N lines, N movements + a flag flip)
// uses `transaction` so a failure partway through leaves NO partial rows.
export type Db = {
  query: Executor;
  transaction: <T>(fn: (exec: Executor) => Promise<T>) => Promise<T>;
};

// The app database, backed by the shared PGlite instance. `transaction` maps
// PGlite's transaction (tx.query -> { rows }) onto the Executor shape so the
// same data-module code runs against the real DB and an in-memory test DB.
export const appDb: Db = {
  query: (text, params) => query(text, params),
  transaction: async (fn) => {
    const db = await getDb();
    return db.transaction(async (tx) => {
      const exec: Executor = (text, params) =>
        tx.query(text, params).then((r) => r.rows as Record<string, unknown>[]);
      return fn(exec);
    });
  }
};
