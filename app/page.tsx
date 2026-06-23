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
          <li>
            <a href="/units">Units</a> — reference data (unit.dbf)
          </li>
          <li>
            <a href="/categories">Categories</a> — reference data (category.dbf)
          </li>
          <li>
            <a href="/brands">Brands</a> — reference data (brand.dbf)
          </li>
          <li>
            <a href="/suppliers">Suppliers</a> — reference data (supplier.dbf)
          </li>
          <li>
            <a href="/items">Items</a> — product catalog (item.dbf)
          </li>
          <li>
            <a href="/inventory">Inventory</a> — stock ledger &amp; movements
          </li>
          <li>
            <a href="/po">Purchase Orders</a> — PO headers &amp; detail (po/podet.dbf)
          </li>
          <li>
            <a href="/dr">Delivery Receipts</a> — DR headers &amp; detail (dr/drdet.dbf)
          </li>
          <li>
            <a href="/settings">Settings</a> — company &amp; app defaults
          </li>
          <li>
            <a href="/login">Sign in</a> — shared-password gate
          </li>
        </ul>
        <p className="muted" style={{ marginBottom: 0, fontSize: 13 }}>
          More modules (A/R, collections, invoicing) come as we thicken the slice.
        </p>
      </div>
    </main>
  );
}
