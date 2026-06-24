// Load the demo dataset (slice S8, issue #25). Builds one coherent PO -> DR -> A/R
// -> Collection scenario by calling the real lib create/post functions, so it
// exercises the same money/stock/A-R machinery as real data. Idempotent — a second
// run is a no-op. Run via `npm run demo:load`.
//
//   • DATABASE_URL set   -> the demo lands in real Postgres (Docker / a droplet).
//   • DATABASE_URL unset -> the local PGlite dev store (./.pglite).
//
// Either way it goes through lib/db.ts `appDb`, the same handle the app uses, so
// every row is created exactly as the running app would create it.
import { loadDemoData } from "../lib/demo";
import { appDb } from "../lib/db";

const summary = await loadDemoData(appDb);
console.log("Demo data loaded:");
for (const [k, v] of Object.entries(summary)) {
  console.log(`  ${k}: ${v}`);
}
console.log("Run `npm run demo:wipe` to remove it.");
process.exit(0);
