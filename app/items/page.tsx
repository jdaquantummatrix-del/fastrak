import { listItems, type Item } from "@/lib/items";
import { listCategories, type Category } from "@/lib/categories";
import { listBrands, type Brand } from "@/lib/brands";
import { listSuppliers, type Supplier } from "@/lib/suppliers";

export const dynamic = "force-dynamic";

function name<T extends { id: string }>(
  rows: T[],
  id: string | null,
  pick: (r: T) => string | null
): string {
  if (!id) return "—";
  const row = rows.find((r) => r.id === id);
  return (row ? pick(row) : null) ?? id;
}

export default async function ItemsPage() {
  let items: Item[] = [];
  let categories: Category[] = [];
  let brands: Brand[] = [];
  let suppliers: Supplier[] = [];
  let error: string | null = null;
  try {
    [items, categories, brands, suppliers] = await Promise.all([
      listItems(),
      listCategories(),
      listBrands(),
      listSuppliers()
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main>
      <div className="crumb">
        <a href="/">← fastrak</a> / items
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Items</h1>

      {error ? (
        <div className="card" style={{ padding: "18px 20px" }}>
          <strong style={{ color: "#f0a3a3" }}>Database not reachable.</strong>
          <p className="muted" style={{ marginBottom: 6 }}>
            Start it and load the data with: <code>npm run db:setup</code>
          </p>
          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
            ({error})
          </p>
        </div>
      ) : (
        <>
          <div className="badge-row">
            <span className="count">{items.length} item(s)</span>
            <span className="tag">source: item.dbf</span>
            <a href="/items/new" className="tag">
              + new item
            </a>
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Unit</th>
                  <th>Pack</th>
                  <th>Cost</th>
                  <th>Price</th>
                  <th>Retail</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th>Supplier</th>
                  <th>Type</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="muted">
                      No items yet — run <code>npm run db:import</code> or add one.
                    </td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <tr
                      key={it.id}
                      style={it.inactive ? { opacity: 0.55 } : undefined}
                    >
                      <td>{it.code ?? "—"}</td>
                      <td>{it.description ?? "—"}</td>
                      <td>
                        {it.unit ?? "—"}
                        {it.unit2 ? ` / ${it.unit2}` : ""}
                      </td>
                      <td>{it.pack_size ?? "—"}</td>
                      <td style={{ textAlign: "right" }}>{it.base_cost ?? "—"}</td>
                      <td style={{ textAlign: "right" }}>{it.price ?? "—"}</td>
                      <td style={{ textAlign: "right" }}>{it.retail ?? "—"}</td>
                      <td>{name(categories, it.category_id, (c) => c.category)}</td>
                      <td>{name(brands, it.brand_id, (b) => b.brand)}</td>
                      <td>{name(suppliers, it.supplier_id, (s) => s.name)}</td>
                      <td>{it.type ?? "—"}</td>
                      <td>
                        <a href={`/items/${it.id}`}>edit</a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
