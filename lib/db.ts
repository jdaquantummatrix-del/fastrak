import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import type { Executor } from "./reference";

// Two database drivers, one code path.
//
//   • Production / Docker  -> real Postgres, selected when DATABASE_URL is set.
//   • Local dev / tests    -> PGlite (Postgres compiled to WASM, in-process,
//                             persisted to ./.pglite). Used when DATABASE_URL is
//                             absent, so `npm run dev` needs no running database.
//
// Both speak the same SQL ($1 placeholders, numeric/timestamptz types), so every
// data module is identical against either. The only difference is here.
const usePostgres = Boolean(process.env.DATABASE_URL);

// Reuse one pool / one PGlite instance across hot reloads (Next re-imports modules).
const g = globalThis as unknown as { __pgPool?: Pool; __pglite?: Promise<PGlite> };

function pool(): Pool {
  if (!g.__pgPool) {
    g.__pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return g.__pgPool;
}

function pglite(): Promise<PGlite> {
  if (!g.__pglite) g.__pglite = PGlite.create(path.join(process.cwd(), ".pglite"));
  return g.__pglite;
}

// PGlite is a SINGLE in-process WASM connection: two queries running at the same
// time corrupt its shared memory ("ArrayBuffer is not detachable"). React Server
// Components fan out (a layout and its page render concurrently, each querying),
// so we serialize every PGlite operation through one promise chain. Production
// Postgres uses a real connection pool and needs none of this.
const gc = globalThis as unknown as {
  __pgliteChain?: Promise<unknown>;
  __pgliteAls?: AsyncLocalStorage<boolean>;
};
const als = (gc.__pgliteAls ??= new AsyncLocalStorage<boolean>());

function runOnPglite<T>(fn: (db: PGlite) => Promise<T>): Promise<T> {
  // Re-entrant call (e.g. a query issued from inside a transaction we're already
  // running): execute directly instead of waiting on the chain we ourselves
  // hold — otherwise we'd deadlock.
  if (als.getStore()) return pglite().then(fn);

  const prior = gc.__pgliteChain ?? Promise.resolve();
  const result = prior.then(() => als.run(true, async () => fn(await pglite())));
  gc.__pgliteChain = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  if (usePostgres) {
    const res = await pool().query(text, params);
    return res.rows as T[];
  }
  return runOnPglite(async (db) => (await db.query<T>(text, params)).rows);
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

// The app database. `transaction` is implemented per-driver but exposes the same
// Executor shape, so the same data-module code runs against Postgres, the dev
// PGlite store, or an in-memory test DB.
export const appDb: Db = {
  query: (text, params) => query(text, params),
  transaction: async (fn) => {
    if (usePostgres) {
      // A pooled client held for the life of the transaction (BEGIN..COMMIT must
      // run on ONE connection). Always released; rolled back on any error.
      const client = await pool().connect();
      try {
        await client.query("begin");
        const exec: Executor = (text, params) =>
          client.query(text, params).then((r) => r.rows as Record<string, unknown>[]);
        const out = await fn(exec);
        await client.query("commit");
        return out;
      } catch (err) {
        await client.query("rollback").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }

    return runOnPglite((db) =>
      db.transaction(async (tx) => {
        const exec: Executor = (text, params) =>
          tx.query(text, params).then((r) => r.rows as Record<string, unknown>[]);
        return fn(exec);
      })
    );
  }
};
