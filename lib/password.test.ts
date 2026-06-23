import { test, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

test("a hashed password verifies against the original", () => {
  const stored = hashPassword("hunter2");
  expect(stored.startsWith("scrypt$")).toBe(true);
  expect(verifyPassword("hunter2", stored)).toBe(true);
});

test("a wrong password does not verify", () => {
  const stored = hashPassword("hunter2");
  expect(verifyPassword("hunter3", stored)).toBe(false);
});

test("the same password hashes differently each time (random salt)", () => {
  expect(hashPassword("hunter2")).not.toBe(hashPassword("hunter2"));
});

test("missing / malformed stored values never verify and never throw", () => {
  expect(verifyPassword("x", null)).toBe(false);
  expect(verifyPassword("x", undefined)).toBe(false);
  expect(verifyPassword("x", "")).toBe(false);
  expect(verifyPassword("x", "not-a-hash")).toBe(false);
  expect(verifyPassword("x", "bcrypt$abc$def")).toBe(false);
});
