// Auth — session cookie signing/verifying for per-user accounts.
//
// A signed, httpOnly cookie carries the authenticated user's id (`sub`). The
// signature is HMAC-SHA256 over the payload under the server secret, so the
// cookie can't be forged and can be verified WITHOUT a database hit (the Edge
// middleware does exactly that on every request). The account row is loaded from
// the id only in Node code (see lib/account.ts). Passwords are verified
// separately, with scrypt, in lib/password.ts.
//
// IMPORTANT: this module is imported by BOTH the Edge middleware (middleware.ts)
// and Node Server Actions. The Edge runtime has no Node `crypto` module, so we
// sign/verify with the Web Crypto API (globalThis.crypto / crypto.subtle), which
// exists in both runtimes. Everything is therefore async.

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

// Token format: "<payloadB64url>.<sigB64url>". The payload is JSON holding the
// authenticated user's id (`sub`), an issued-at, and an expiry. The signature is
// HMAC-SHA256(payload) under the server secret.
export type SessionPayload = { sub: string; iat: number; exp: number };

export async function signSession(
  secret: string,
  sub: string,
  nowMs: number = Date.now()
): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  const payload: SessionPayload = { sub, iat, exp: iat + SESSION_MAX_AGE_SECONDS };
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = bytesToBase64Url(await hmac(secret, body));
  return `${body}.${sig}`;
}

// Returns the payload only if `token` is well-formed, the signature matches
// `secret`, it carries a `sub`, and it has not expired. Otherwise null. Never
// throws — any malformed input is just null.
export async function verifySession(
  token: string,
  secret: string,
  nowMs: number = Date.now()
): Promise<SessionPayload | null> {
  try {
    if (!token || !secret) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    if (!body || !sig) return null;

    const expected = await hmac(secret, body);
    const given = base64UrlToBytes(sig);
    if (!timingSafeEqual(expected, given)) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(body))
    ) as SessionPayload;
    if (typeof payload.exp !== "number" || typeof payload.sub !== "string") return null;
    if (!payload.sub) return null;
    if (Math.floor(nowMs / 1000) >= payload.exp) return null; // expired
    return payload;
  } catch {
    return null;
  }
}

// The server-side secret used to sign sessions. In production this MUST be set
// (docker-compose requires it). A loud, obviously-insecure dev fallback keeps
// `npm run dev` working without configuration.
export function getSessionSecret(): string {
  return process.env.SESSION_SECRET || "kenny-dev-insecure-session-secret-change-me";
}
