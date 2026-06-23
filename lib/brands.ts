// Data module for the Brand reference table (fastrak brand.dbf).
import {
  type Executor,
  defaultExecutor,
  newId,
  required,
  clean
} from "./reference";

export type Brand = {
  id: string;
  brand: string | null;
  remarks: string | null;
};

export type BrandInput = {
  brand: string;
  remarks?: string | null;
};

export async function listBrands(exec: Executor = defaultExecutor): Promise<Brand[]> {
  return (await exec(
    `select id, brand, remarks from brands order by brand nulls last, id`
  )) as Brand[];
}

export async function createBrand(
  input: BrandInput,
  exec: Executor = defaultExecutor
): Promise<Brand> {
  const brand = required(input.brand, "brand");
  const id = newId();
  const rows = await exec(
    `insert into brands (id, brand, remarks)
       values ($1, $2, $3)
     returning id, brand, remarks`,
    [id, brand, clean(input.remarks)]
  );
  return rows[0] as Brand;
}

export async function updateBrand(
  id: string,
  input: BrandInput,
  exec: Executor = defaultExecutor
): Promise<Brand> {
  const brand = required(input.brand, "brand");
  const rows = await exec(
    `update brands set brand = $2, remarks = $3, updated_at = now()
      where id = $1
    returning id, brand, remarks`,
    [id, brand, clean(input.remarks)]
  );
  if (rows.length === 0) throw new Error(`brand ${id} not found`);
  return rows[0] as Brand;
}

export async function getBrand(
  id: string,
  exec: Executor = defaultExecutor
): Promise<Brand | null> {
  const rows = (await exec(
    `select id, brand, remarks from brands where id = $1`,
    [id]
  )) as Brand[];
  return rows[0] ?? null;
}
