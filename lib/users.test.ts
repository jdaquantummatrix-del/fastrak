import { test, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asDb } from "./test-db";
import {
  createUser,
  getUserByUsername,
  getGrants,
  allowedModuleKeys,
  setRole,
  setActive,
  setGrant,
  setCanSeePrices
} from "./users";
import { verifyPassword } from "./password";

let pg: PGlite;
beforeEach(async () => {
  pg = await createTestDb();
});

test("createUser stores a hashed password and applies the role preset", async () => {
  const db = asDb(pg);
  const acc = await createUser(
    { username: "Maria", name: "Maria Santos", role: "sales", password: "secret1" },
    db
  );
  expect(acc.username).toBe("maria"); // lowercased
  expect(acc.isAdmin).toBe(false);

  const withHash = await getUserByUsername("maria", db.query);
  expect(withHash).not.toBeNull();
  expect(withHash!.passwordHash).not.toBe("secret1"); // never stored plaintext
  expect(verifyPassword("secret1", withHash!.passwordHash)).toBe(true);

  // The "sales" preset grants edit on dr but no access to settings.
  const allowed = await allowedModuleKeys(acc, db.query);
  expect(allowed.has("dr")).toBe(true);
  expect(allowed.has("settings")).toBe(false);
});

test("usernames are unique (case-insensitively)", async () => {
  const db = asDb(pg);
  await createUser({ username: "sam", role: "viewer", password: "pw123" }, db);
  await expect(
    createUser({ username: "SAM", role: "viewer", password: "pw123" }, db)
  ).rejects.toThrow(/already taken/);
});

test("a too-short password is rejected", async () => {
  const db = asDb(pg);
  await expect(
    createUser({ username: "tiny", role: "viewer", password: "no" }, db)
  ).rejects.toThrow(/at least 4/);
});

test("admins reach every module regardless of grant rows", async () => {
  const db = asDb(pg);
  const admin = await createUser(
    { username: "boss", role: "admin", password: "pw1234" },
    db
  );
  expect(admin.isAdmin).toBe(true);
  const allowed = await allowedModuleKeys(admin, db.query);
  expect(allowed.has("settings")).toBe(true);
  expect(allowed.has("dr")).toBe(true);
});

test("the last active admin cannot be demoted or deactivated", async () => {
  const db = asDb(pg);
  const admin = await createUser(
    { username: "boss", role: "admin", password: "pw1234" },
    db
  );
  await expect(setRole(admin.id, "sales", db)).rejects.toThrow(/last active admin/i);
  await expect(setActive(admin.id, false, db.query)).rejects.toThrow(
    /last active admin/i
  );

  // With a second admin present, demoting the first is allowed.
  const admin2 = await createUser(
    { username: "boss2", role: "admin", password: "pw1234" },
    db
  );
  await setRole(admin.id, "sales", db);
  const allowed = await allowedModuleKeys(
    (await getUserByUsername("boss", db.query))!,
    db.query
  );
  expect(allowed.has("settings")).toBe(false);
  expect(admin2.isAdmin).toBe(true);
});

test("setGrant toggles a single module on and off", async () => {
  const db = asDb(pg);
  const u = await createUser({ username: "ed", role: "viewer", password: "pw1234" }, db);
  await setGrant(u.id, "settings", "edit", db.query);
  let grants = await getGrants(u.id, db.query);
  expect(grants.find((g) => g.moduleKey === "settings")?.access).toBe("edit");

  await setGrant(u.id, "settings", "off", db.query);
  grants = await getGrants(u.id, db.query);
  expect(grants.find((g) => g.moduleKey === "settings")).toBeUndefined();
});

test("setCanSeePrices flips the sensitive-info flag", async () => {
  const db = asDb(pg);
  const u = await createUser({ username: "ann", role: "viewer", password: "pw1234" }, db);
  await setCanSeePrices(u.id, true, db.query);
  const reloaded = await getUserByUsername("ann", db.query);
  expect(reloaded!.canSeePrices).toBe(true);
});
