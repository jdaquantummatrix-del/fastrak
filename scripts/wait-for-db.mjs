// Wait until Postgres accepts connections (used after `docker compose up`).
import pg from "pg";

const conn =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/projectkenny";

const deadline = Date.now() + 60_000;
for (;;) {
  const client = new pg.Client({ connectionString: conn });
  try {
    await client.connect();
    await client.query("select 1");
    await client.end();
    console.log("database is ready");
    process.exit(0);
  } catch {
    await client.end().catch(() => {});
    if (Date.now() > deadline) {
      console.error("database did not become ready within 60s");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}
