import { test, expect } from "vitest";
import { createTestDb } from "./test-db";

// PATTERN for every slice's tests: spin up a fresh in-memory DB with the full
// schema, exercise behaviour, assert on results. Copy this shape into
// lib/<entity>.test.ts. Test EXTERNAL behaviour (data in -> data out), not SQL.
test("schema applies and the customers table is usable", async () => {
  const db = await createTestDb();
  await db.query(
    "insert into customers (id, name) values ($1, $2)",
    ["TEST000001", "Acme Trading"]
  );
  const { rows } = await db.query<{ name: string }>(
    "select name from customers where id = $1",
    ["TEST000001"]
  );
  expect(rows[0]?.name).toBe("Acme Trading");
  await db.close();
});
