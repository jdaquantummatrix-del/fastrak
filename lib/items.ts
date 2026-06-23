// Data module for the Item table (fastrak item.dbf) — the product catalog.
// See docs/analysis/fastrak-overview.md and issue #7 for the field mapping.
// New rows get a freshly generated 10-char text id, matching fastrak's legacy
// CID keys (ADR-0002). Money (base_cost/price/retail) is numeric(14,2); Postgres
// returns it as an exact decimal *string* (e.g. "12.34"), never a float — so
// there is no drift (ADR-0001 fidelity).
import {
  type Executor,
  defaultExecutor,
  newId,
  required,
  clean
} from "./reference";

export type Item = {
  id: string;
  code: string | null;
  description: string | null;
  unit: string | null;
  unit2: string | null;
  pack_size: number | null;
  base_cost: string | null; // numeric -> exact decimal string
  price: string | null;
  retail: string | null;
  category_id: string | null;
  brand_id: string | null;
  supplier_id: string | null;
  inactive: boolean | null;
  critical: number | null;
  pic: string | null;
  type: string | null;
};

export type ItemInput = {
  code: string;
  description?: string | null;
  unit?: string | null;
  unit2?: string | null;
  pack_size?: number | null;
  base_cost?: number | string | null;
  price?: number | string | null;
  retail?: number | string | null;
  category_id?: string | null;
  brand_id?: string | null;
  supplier_id?: string | null;
  inactive?: boolean | null;
  critical?: number | null;
  pic?: string | null;
  type?: string | null;
};

const COLUMNS =
  "id, code, description, unit, unit2, pack_size, base_cost, price, retail, " +
  "category_id, brand_id, supplier_id, inactive, critical, pic, type";

// A money value -> null when blank, otherwise the raw value (Postgres parses the
// decimal). Keeping it as-is avoids any binary-float round-trip.
function money(v: number | string | null | undefined): number | string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  return v;
}

function values(input: ItemInput, code: string): unknown[] {
  return [
    code,
    clean(input.description),
    clean(input.unit),
    clean(input.unit2),
    input.pack_size ?? null,
    money(input.base_cost),
    money(input.price),
    money(input.retail),
    clean(input.category_id),
    clean(input.brand_id),
    clean(input.supplier_id),
    input.inactive ?? null,
    input.critical ?? null,
    clean(input.pic),
    clean(input.type)
  ];
}

export async function listItems(exec: Executor = defaultExecutor): Promise<Item[]> {
  return (await exec(
    `select ${COLUMNS} from items order by code nulls last, id`
  )) as Item[];
}

export async function getItem(
  id: string,
  exec: Executor = defaultExecutor
): Promise<Item | null> {
  const rows = (await exec(`select ${COLUMNS} from items where id = $1`, [
    id
  ])) as Item[];
  return rows[0] ?? null;
}

export async function createItem(
  input: ItemInput,
  exec: Executor = defaultExecutor
): Promise<Item> {
  const code = required(input.code, "code");
  const id = newId();
  const rows = await exec(
    `insert into items
       (id, tenant_id, code, description, unit, unit2, pack_size, base_cost,
        price, retail, category_id, brand_id, supplier_id, inactive, critical,
        pic, type)
     values ($1,'fastrak',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     returning ${COLUMNS}`,
    [id, ...values(input, code)]
  );
  return rows[0] as Item;
}

export async function updateItem(
  id: string,
  input: ItemInput,
  exec: Executor = defaultExecutor
): Promise<Item> {
  const code = required(input.code, "code");
  // pic uses COALESCE so an edit that doesn't supply a pic ($15 = null) PRESERVES
  // the existing image path. The item edit form has no pic field, so without this
  // every save would null out the picture (data loss). A real path still updates.
  const rows = await exec(
    `update items set
       code = $2, description = $3, unit = $4, unit2 = $5, pack_size = $6,
       base_cost = $7, price = $8, retail = $9, category_id = $10, brand_id = $11,
       supplier_id = $12, inactive = $13, critical = $14, pic = COALESCE($15, pic),
       type = $16, updated_at = now()
      where id = $1
    returning ${COLUMNS}`,
    [id, ...values(input, code)]
  );
  if (rows.length === 0) throw new Error(`item ${id} not found`);
  return rows[0] as Item;
}
