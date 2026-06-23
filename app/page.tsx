export default function Home() {
  return (
    <main>
      <div className="kicker">Project Kenny</div>
      <h1>fastrak — web rebuild</h1>
      <p className="muted">
        The first vertical slice of Kennard&apos;s FoxPro distribution system, rebuilt as a
        web app. Real data migrated from <code>customer.dbf</code> into Postgres.
      </p>
      <div className="card" style={{ padding: "18px 20px" }}>
        <strong>Modules</strong>
        <ul style={{ margin: "10px 0 0" }}>
          <li>
            <a href="/customers">Customers</a> — list of migrated customers
          </li>
        </ul>
        <p className="muted" style={{ marginBottom: 0, fontSize: 13 }}>
          More modules (items, delivery receipts, A/R, collections) come as we thicken the
          slice.
        </p>
      </div>
    </main>
  );
}
