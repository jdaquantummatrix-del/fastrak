// Password hashing — scrypt via Node's built-in crypto (zero dependencies,
// matches the QMDI app). Format: "scrypt$<saltHex>$<hashHex>".
//
// NODE-ONLY. This module imports node:crypto and must NEVER be imported by the
// Edge middleware. Only Server Actions and Node data code touch it. (The session
// cookie signing in lib/auth.ts uses Web Crypto precisely so it CAN run on Edge.)
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

// Constant-time verify. Returns false for any malformed/missing stored value.
export function verifyPassword(
  plain: string,
  stored: string | null | undefined
): boolean {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(plain, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
