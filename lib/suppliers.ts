// Data module for the Supplier reference table (fastrak supplier.dbf).
import {
  type Executor,
  defaultExecutor,
  newId,
  required,
  clean
} from "./reference";

export type Supplier = {
  id: string;
  name: string | null;
  terms_days: number | null;
  contact_person: string | null;
  tel_no: string | null;
  fax_no: string | null;
  address: string | null;
  is_local: boolean | null;
  remarks: string | null;
};

export type SupplierInput = {
  name: string;
  terms_days?: number | null;
  contact_person?: string | null;
  tel_no?: string | null;
  fax_no?: string | null;
  address?: string | null;
  is_local?: boolean | null;
  remarks?: string | null;
};

const COLUMNS =
  "id, name, terms_days, contact_person, tel_no, fax_no, address, is_local, remarks";

export async function listSuppliers(
  exec: Executor = defaultExecutor
): Promise<Supplier[]> {
  return (await exec(
    `select ${COLUMNS} from suppliers order by name nulls last, id`
  )) as Supplier[];
}

export async function createSupplier(
  input: SupplierInput,
  exec: Executor = defaultExecutor
): Promise<Supplier> {
  const name = required(input.name, "name");
  const id = newId();
  const rows = await exec(
    `insert into suppliers
       (id, name, terms_days, contact_person, tel_no, fax_no, address, is_local, remarks)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning ${COLUMNS}`,
    [
      id,
      name,
      input.terms_days ?? null,
      clean(input.contact_person),
      clean(input.tel_no),
      clean(input.fax_no),
      clean(input.address),
      input.is_local ?? null,
      clean(input.remarks)
    ]
  );
  return rows[0] as Supplier;
}

export async function updateSupplier(
  id: string,
  input: SupplierInput,
  exec: Executor = defaultExecutor
): Promise<Supplier> {
  const name = required(input.name, "name");
  const rows = await exec(
    `update suppliers set
       name = $2, terms_days = $3, contact_person = $4, tel_no = $5,
       fax_no = $6, address = $7, is_local = $8, remarks = $9, updated_at = now()
      where id = $1
    returning ${COLUMNS}`,
    [
      id,
      name,
      input.terms_days ?? null,
      clean(input.contact_person),
      clean(input.tel_no),
      clean(input.fax_no),
      clean(input.address),
      input.is_local ?? null,
      clean(input.remarks)
    ]
  );
  if (rows.length === 0) throw new Error(`supplier ${id} not found`);
  return rows[0] as Supplier;
}

export async function getSupplier(
  id: string,
  exec: Executor = defaultExecutor
): Promise<Supplier | null> {
  const rows = (await exec(`select ${COLUMNS} from suppliers where id = $1`, [
    id
  ])) as Supplier[];
  return rows[0] ?? null;
}
