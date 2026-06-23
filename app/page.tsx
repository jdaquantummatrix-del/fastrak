import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function peso(v: string | number): string {
  return Number(v ?? 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export default async function Dashboard() {
  let customers = 0;
  let items = 0;
  let openDRs = 0;
  let outstanding = "0.00";
  let error: string | null = null;

  try {
    const [c, i, d, a] = await Promise.all([
      query<{ n: number }>("select count(*)::int n from customers"),
      query<{ n: number }>("select count(*)::int n from items"),
      query<{ n: number }>(
        "select count(*)::int n from dr where posted = true and cancelled = false"
      ),
      query<{ total: string }>(
        "select coalesce(sum(amount), 0)::numeric(14,2) total from ar"
      )
    ]);
    customers = c[0]?.n ?? 0;
    items = i[0]?.n ?? 0;
    openDRs = d[0]?.n ?? 0;
    outstanding = a[0]?.total ?? "0.00";
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const stats = [
    { label: "Outstanding A/R", value: `₱ ${peso(outstanding)}`, href: "/ar" },
    { label: "Posted delivery receipts", value: String(openDRs), href: "/dr" },
    { label: "Items in catalog", value: String(items), href: "/items" },
    { label: "Customers", value: String(customers), href: "/customers" }
  ];

  const links: [string, string, string][] = [
    ["Delivery Receipts", "Create and post sales to customers", "/dr"],
    ["Collections", "Record payments against receivables", "/collections"],
    ["Purchase Orders", "Order from suppliers, receive into stock", "/po"],
    ["Stock", "Current inventory levels and movements", "/inventory"]
  ];

  return (
    <main>
      <div className="page-header">
        <div>
          <div className="kicker">Overview</div>
          <h1>Dashboard</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="btn" href="/customers/new">
            New customer
          </a>
          <a className="btn btn-primary" href="/dr/new">
            New delivery receipt
          </a>
        </div>
      </div>

      {error ? (
        <div className="notice notice-error">
          <strong>Database not reachable.</strong>{" "}
          <span className="muted">
            Run <code>npm run db:setup</code>. ({error})
          </span>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 14
            }}
          >
            {stats.map((s) => (
              <a
                key={s.label}
                href={s.href}
                className="card pad"
                style={{ textDecoration: "none", display: "block" }}
              >
                <div
                  style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 550 }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 680,
                    letterSpacing: "-0.02em",
                    marginTop: 6,
                    color: "var(--ink)",
                    fontVariantNumeric: "tabular-nums"
                  }}
                >
                  {s.value}
                </div>
              </a>
            ))}
          </div>

          <h2>Quick links</h2>
          <div className="card">
            <table>
              <tbody>
                {links.map(([t, d, h]) => (
                  <tr key={h}>
                    <td style={{ width: "32%" }}>
                      <a href={h} style={{ fontWeight: 600 }}>
                        {t}
                      </a>
                    </td>
                    <td className="muted">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
