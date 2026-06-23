import { test, expect } from "vitest";
import { createTestDb } from "./test-db";
import { getCompany, upsertCompany } from "./company";
import { listSettings, getSetting, updateSetting } from "./settings";

// A PGlite-backed executor matching the lib/db.ts `query` shape.
function executor(db: Awaited<ReturnType<typeof createTestDb>>) {
  return (text: string, params?: unknown[]) =>
    db.query(text, params).then((r) => r.rows as Record<string, unknown>[]);
}

// ---- Company (singleton "our business" info) ----

test("getCompany returns null when no company exists", async () => {
  const db = await createTestDb();
  const q = executor(db);
  expect(await getCompany(q)).toBeNull();
  await db.close();
});

test("upsertCompany creates the company then getCompany reads it back", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const created = await upsertCompany(
    {
      name: "Wilson Trading",
      address: "12 Industrial Rd, Manila",
      proprietor: "J. Wilson",
      tin: "123-456-789",
      tel_no: "02-555-1234",
      fax_no: "02-555-5678"
    },
    q
  );
  expect(created.name).toBe("Wilson Trading");
  expect(created.proprietor).toBe("J. Wilson");

  const company = await getCompany(q);
  expect(company?.name).toBe("Wilson Trading");
  expect(company?.address).toBe("12 Industrial Rd, Manila");
  await db.close();
});

test("upsertCompany generates a unique 10-char text id for a new company", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const created = await upsertCompany({ name: "New Co" }, q);
  expect(created.id).toHaveLength(10);
  await db.close();
});

test("upsertCompany updates the existing row rather than inserting a second", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const first = await upsertCompany({ name: "Old Name", tin: "111" }, q);
  const second = await upsertCompany(
    { name: "New Name", tin: "222", tel_no: "02-999" },
    q
  );

  // Same row (id preserved), updated values, and only one company row exists.
  expect(second.id).toBe(first.id);
  expect(second.name).toBe("New Name");
  expect(second.tin).toBe("222");

  const rows = await q("select count(*)::int as n from company");
  expect(rows[0]?.n).toBe(1);
  await db.close();
});

test("upsertCompany stores blank strings as null", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const created = await upsertCompany(
    { name: "Sparse Co", address: "   ", fax_no: "" },
    q
  );
  expect(created.address).toBeNull();
  expect(created.fax_no).toBeNull();
  await db.close();
});

test("upsertCompany rejects a blank name", async () => {
  const db = await createTestDb();
  const q = executor(db);
  await expect(upsertCompany({ name: "  " }, q)).rejects.toThrow();
  await db.close();
});

test("upsertCompany tags the tenant as fastrak", async () => {
  const db = await createTestDb();
  const q = executor(db);

  const created = await upsertCompany({ name: "Tenant Co" }, q);
  const rows = await q("select tenant_id from company where id = $1", [
    created.id
  ]);
  expect(rows[0]?.tenant_id).toBe("fastrak");
  await db.close();
});

// ---- App settings (key/value defaults) ----

// Seed a setting row directly (mirrors what the import script produces).
async function seedSetting(
  q: ReturnType<typeof executor>,
  id: string,
  application: string,
  value: string
) {
  await q(
    `insert into app_settings (id, tenant_id, application, value)
     values ($1, 'fastrak', $2, $3)`,
    [id, application, value]
  );
}

test("listSettings returns seeded settings ordered by application", async () => {
  const db = await createTestDb();
  const q = executor(db);

  await seedSetting(q, "AD     H", "pctextboxid", "Santos");
  await seedSetting(q, "AD     5", "Pctextboxname", "Wilson");

  const settings = await listSettings(q);
  expect(settings).toHaveLength(2);
  expect(settings[0]?.application).toBe("Pctextboxname");
  expect(settings[0]?.value).toBe("Wilson");
  await db.close();
});

test("updateSetting changes only the value, leaving the key intact", async () => {
  const db = await createTestDb();
  const q = executor(db);

  await seedSetting(q, "AD     5", "Pctextboxname", "Wilson");
  const updated = await updateSetting("AD     5", { value: "Cruz" }, q);

  expect(updated.application).toBe("Pctextboxname");
  expect(updated.value).toBe("Cruz");

  const fresh = await getSetting("AD     5", q);
  expect(fresh?.value).toBe("Cruz");
  await db.close();
});

test("updateSetting blanks an empty value to null", async () => {
  const db = await createTestDb();
  const q = executor(db);

  await seedSetting(q, "AD     5", "Pctextboxname", "Wilson");
  const updated = await updateSetting("AD     5", { value: "   " }, q);
  expect(updated.value).toBeNull();
  await db.close();
});

test("updateSetting throws when the id does not exist", async () => {
  const db = await createTestDb();
  const q = executor(db);
  await expect(
    updateSetting("MISSING", { value: "x" }, q)
  ).rejects.toThrow();
  await db.close();
});

test("getSetting returns null for an unknown id", async () => {
  const db = await createTestDb();
  const q = executor(db);
  expect(await getSetting("NOPE", q)).toBeNull();
  await db.close();
});
