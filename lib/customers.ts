// Data module for the Customer table (fastrak customer.dbf). See
// docs/analysis/fastrak-overview.md for the field mapping. New rows get a
// freshly generated 10-char text id, matching fastrak's legacy CID keys (ADR-0002).
import {
  type Executor,
  defaultExecutor,
  newId,
  required,
  clean
} from "./reference";

export type Customer = {
  id: string;
  name: string | null;
  type: string | null;
  terms_days: number | null;
  address: string | null;
  contact_person: string | null;
  mobile: string | null;
  tel_no: string | null;
  fax_no: string | null;
  tin: string | null;
  remarks: string | null;
};

export type CustomerInput = {
  name: string;
  type?: string | null;
  terms_days?: number | null;
  address?: string | null;
  contact_person?: string | null;
  mobile?: string | null;
  tel_no?: string | null;
  fax_no?: string | null;
  tin?: string | null;
  remarks?: string | null;
};

const COLUMNS =
  "id, name, type, terms_days, address, contact_person, mobile, tel_no, fax_no, tin, remarks";

export async function listCustomers(
  exec: Executor = defaultExecutor
): Promise<Customer[]> {
  return (await exec(
    `select ${COLUMNS} from customers order by name nulls last, id`
  )) as Customer[];
}

export async function getCustomer(
  id: string,
  exec: Executor = defaultExecutor
): Promise<Customer | null> {
  const rows = (await exec(`select ${COLUMNS} from customers where id = $1`, [
    id
  ])) as Customer[];
  return rows[0] ?? null;
}

export async function createCustomer(
  input: CustomerInput,
  exec: Executor = defaultExecutor
): Promise<Customer> {
  const name = required(input.name, "name");
  const id = newId();
  const rows = await exec(
    `insert into customers
       (id, tenant_id, name, type, terms_days, address, contact_person,
        mobile, tel_no, fax_no, tin, remarks)
     values ($1, 'fastrak', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning ${COLUMNS}`,
    [
      id,
      name,
      clean(input.type),
      input.terms_days ?? null,
      clean(input.address),
      clean(input.contact_person),
      clean(input.mobile),
      clean(input.tel_no),
      clean(input.fax_no),
      clean(input.tin),
      clean(input.remarks)
    ]
  );
  return rows[0] as Customer;
}

export async function updateCustomer(
  id: string,
  input: CustomerInput,
  exec: Executor = defaultExecutor
): Promise<Customer> {
  const name = required(input.name, "name");
  const rows = await exec(
    `update customers set
       name = $2, type = $3, terms_days = $4, address = $5, contact_person = $6,
       mobile = $7, tel_no = $8, fax_no = $9, tin = $10, remarks = $11,
       updated_at = now()
      where id = $1
    returning ${COLUMNS}`,
    [
      id,
      name,
      clean(input.type),
      input.terms_days ?? null,
      clean(input.address),
      clean(input.contact_person),
      clean(input.mobile),
      clean(input.tel_no),
      clean(input.fax_no),
      clean(input.tin),
      clean(input.remarks)
    ]
  );
  if (rows.length === 0) throw new Error(`customer ${id} not found`);
  return rows[0] as Customer;
}
