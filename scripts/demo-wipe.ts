// Wipe the demo dataset (slice S8, issue #25). Removes every row the demo loader
// created — and ONLY those rows, tracked in the demo_data registry — in FK-safe
// order, then clears the registry. Real client data, never registered, is left
// untouched. Idempotent — wiping when nothing is loaded is a no-op. Run via
// `npm run demo:wipe`.
//
//   • DATABASE_URL set   -> wipes the demo from real Postgres.
//   • DATABASE_URL unset -> wipes the demo from the local PGlite dev store.
import { wipeDemoData } from "../lib/demo";
import { appDb } from "../lib/db";

// Wrapped in a function (not top-level await) so tsx can run this under the
// project's CommonJS output, which does not allow top-level await.
async function main() {
  const { removed } = await wipeDemoData(appDb);
  console.log(`Demo data wiped: ${removed} row(s) removed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
