// S12 Auth (HITL) — the minimal "simple login now" gate.
//
// This is deliberately small: one shared password (APP_PASSWORD) lets a user in,
// and we hand them a signed, httpOnly session cookie. There are no per-user
// accounts, roles, or permissions yet — that real model is designed later, see
// docs/adr/0004-auth-model.md (Status: Proposed).
//
// IMPORTANT: this module is imported by BOTH the Edge middleware (middleware.ts)
// and Node Server Actions (app/login/actions.ts). The Edge runtime has no Node
// `crypto` module, so we sign/verify with the Web Crypto API (globalThis.crypto
// / crypto.subtle), which exists in both runtimes. Everything is therefore async.

// Cookie name. Namespaced so it can't collide with anything else on the host.
export const SESSION_COOKIE = "kenny_session";

// How long a login lasts (7 days). Used for the cookie Max-Age and as the token's
// own expiry, so an old cookie can't be replayed forever even if it leaks.
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

// --- base64url helpers (no Buffer — Edge-safe) -----------------------------

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --- HMAC over Web Crypto --------------------------------------------------

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return new Uint8Array(sig);
}

// Constant-time-ish comparison of two byte arrays (avoids early-exit timing leak).
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// --- session token ---------------------------------------------------------

// Token format: "<payloadB64url>.<sigB64url>". The payload is JSON holding only
// an issued-at and expiry (no user identity yet — there are no users). The
// signature is HMAC-SHA256(payload) under the server secret.
type SessionPayload = { iat: number; exp: number };

export async function signSession(
  secret: string,
  nowMs: number = Date.now()
): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  const payload: SessionPayload = { iat, exp: iat + SESSION_MAX_AGE_SECONDS };
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = bytesToBase64Url(await hmac(secret, body));
  return `${body}.${sig}`;
}

// Returns true only if `token` is well-formed, the signature matches `secret`,
// and the token has not expired. Never throws — any malformed input is just false.
export async function verifySession(
  token: string,
  secret: string,
  nowMs: number = Date.now()
): Promise<boolean> {
  try {
    if (!token || !secret) return false;
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [body, sig] = parts;
    if (!body || !sig) return false;

    const expected = await hmac(secret, body);
    const given = base64UrlToBytes(sig);
    if (!timingSafeEqual(expected, given)) return false;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(body))
    ) as SessionPayload;
    if (typeof payload.exp !== "number") return false;
    if (Math.floor(nowMs / 1000) >= payload.exp) return false; // expired
    return true;
  } catch {
    return false;
  }
}

// Exact match of a submitted password against the configured one, in (roughly)
// constant time. A blank configured password means "no password set" -> always
// false, so an unconfigured deployment can't be entered with an empty string.
export function passwordMatches(submitted: string, configured: string): boolean {
  if (!configured) return false;
  const enc = new TextEncoder();
  return timingSafeEqual(enc.encode(submitted), enc.encode(configured));
}

// The server-side secret used to sign sessions. Falls back to APP_PASSWORD so a
// minimal deployment only has to set ONE env var; SESSION_SECRET can be set
// separately for a stronger, independent signing key.
export function getSessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || "";
}
