// Apply every db/schema/*.sql file to the local dev database (PGlite at ./.pglite).
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const db = await PGlite.create("./.pglite");
const dir = path.resolve("db/schema");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
for (const f of files) {
  await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  console.log(`applied ${f}`);
}
await db.close();
console.log("schema applied (pglite)");
