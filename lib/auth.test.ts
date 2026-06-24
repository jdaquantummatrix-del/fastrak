import { test, expect } from "vitest";
import { signSession, verifySession, SESSION_COOKIE } from "./auth";

// Auth session-token helper. These tests exercise EXTERNAL behaviour: a token we
// sign for a given user verifies and yields back that user's id; any tampering
// (wrong secret, edited body/signature, garbage) is rejected. The helper is
// Web-Crypto based so it runs in both the Edge middleware and Node Server Actions.

const SECRET = "test-secret-value-please-change";

test("a freshly signed session verifies and returns the user id", async () => {
  const token = await signSession(SECRET, "USER123");
  const payload = await verifySession(token, SECRET);
  expect(payload?.sub).toBe("USER123");
});

test("a session signed with a different secret does NOT verify", async () => {
  const token = await signSession(SECRET, "USER123");
  expect(await verifySession(token, "some-other-secret")).toBeNull();
});

test("a tampered token does NOT verify", async () => {
  const token = await signSession(SECRET, "USER123");
  // Tamper the FIRST character of the signature segment. Flipping the LAST
  // base64url char is unreliable: its unused low-order padding bits can decode to
  // the SAME signature bytes, so verification would still pass (this made the
  // test flaky). The first char carries the high-order bits of byte 0, so
  // changing it to any other base64url char always changes the decoded signature.
  const [body, sig] = token.split(".");
  const tamperedFirst = sig[0] === "A" ? "B" : "A";
  const tampered = `${body}.${tamperedFirst}${sig.slice(1)}`;
  expect(await verifySession(tampered, SECRET)).toBeNull();
});

test("garbage / empty input does NOT verify (and never throws)", async () => {
  expect(await verifySession("", SECRET)).toBeNull();
  expect(await verifySession("not-a-token", SECRET)).toBeNull();
  expect(await verifySession("a.b.c.d", SECRET)).toBeNull();
});

test("an expired token does NOT verify", async () => {
  // Sign with a timestamp far in the past so it is already expired now.
  const token = await signSession(SECRET, "USER123", 1_000_000_000_000);
  expect(await verifySession(token, SECRET)).toBeNull();
});

test("the cookie name is a stable, namespaced constant", () => {
  expect(SESSION_COOKIE).toBe("kenny_session");
});
