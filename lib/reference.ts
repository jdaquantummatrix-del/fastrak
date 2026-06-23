// Shared helpers for the S1 reference-data modules (units, categories, brands,
// suppliers). New rows get a freshly generated 10-char text id, in the same
// shape as fastrak's legacy CID keys (see ADR-0002).
import { query } from "./db";

// An executor: same shape as lib/db.ts `query`, so app code uses the real DB and
// tests inject a PGlite-backed runner (createTestDb). Defaults to the app query.
export type Executor = (
  text: string,
  params?: unknown[]
) => Promise<Record<string, unknown>[]>;

export const defaultExecutor: Executor = (text, params) => query(text, params);

// A unique 10-char id (uppercase alphanumeric), matching fastrak's CID width.
export function newId(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 10; i++) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
}

// Trim a free-text field; empty -> null (FoxPro pads fixed-width with spaces).
export function clean(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

// Require a non-blank value or throw (used for each entity's required field).
export function required(v: string | null | undefined, field: string): string {
  const t = clean(v);
  if (t === null) throw new Error(`${field} is required`);
  return t;
}
