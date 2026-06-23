import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

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
