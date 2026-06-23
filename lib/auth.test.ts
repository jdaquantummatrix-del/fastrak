import { test, expect } from "vitest";
import {
  signSession,
  verifySession,
  SESSION_COOKIE,
  passwordMatches
} from "./auth";

// S12 Auth (HITL) — the simple "login now" gate. These tests exercise the
// session-token helper's EXTERNAL behaviour: a token we sign verifies, and any
// tampering (wrong secret, edited body/signature, garbage) is rejected. The
// helper is Web-Crypto based so it runs in both the Edge middleware and Node
// Server Actions. See docs/adr/0004-auth-model.md for the real model (later).

const SECRET = "test-secret-value-please-change";

test("a freshly signed session verifies with the same secret", async () => {
  const token = await signSession(SECRET);
  expect(await verifySession(token, SECRET)).toBe(true);
});

test("a session signed with a different secret does NOT verify", async () => {
  const token = await signSession(SECRET);
  expect(await verifySession(token, "some-other-secret")).toBe(false);
});

test("a tampered token does NOT verify", async () => {
  const token = await signSession(SECRET);
  // Flip the last character of the signature.
  const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
  expect(await verifySession(tampered, SECRET)).toBe(false);
});

test("garbage / empty input does NOT verify (and never throws)", async () => {
  expect(await verifySession("", SECRET)).toBe(false);
  expect(await verifySession("not-a-token", SECRET)).toBe(false);
  expect(await verifySession("a.b.c.d", SECRET)).toBe(false);
});

test("the cookie name is a stable, namespaced constant", () => {
  expect(SESSION_COOKIE).toBe("kenny_session");
});

test("passwordMatches is a constant-time-ish exact compare", () => {
  expect(passwordMatches("hunter2", "hunter2")).toBe(true);
  expect(passwordMatches("hunter2", "hunter3")).toBe(false);
  expect(passwordMatches("hunter2", "hunter22")).toBe(false);
  expect(passwordMatches("hunter2", "")).toBe(false);
  // A blank configured password is treated as "no password set" -> never matches.
  expect(passwordMatches("", "")).toBe(false);
});
