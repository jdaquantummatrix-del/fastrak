// Data module for the Company table (fastrak company.dbf): the business's own
// info, used for document/report headers. There is one company per tenant, so
// this exposes a read (getCompany) + a single upsert (upsertCompany) rather than
// a list. New companies get a freshly generated 10-char text id (ADR-0002).
import {
  type Executor,
  defaultExecutor,
  newId,
  required,
  clean
} from "./reference";

export type Company = {
  id: string;
  name: string | null;
  address: string | null;
  proprietor: string | null;
  tin: string | null;
  tel_no: string | null;
  fax_no: string | null;
};

export type CompanyInput = {
  name: string;
  address?: string | null;
  proprietor?: string | null;
  tin?: string | null;
  tel_no?: string | null;
  fax_no?: string | null;
};

const COLUMNS = "id, name, address, proprietor, tin, tel_no, fax_no";

// The single company row for the tenant, or null if none has been set yet.
export async function getCompany(
  exec: Executor = defaultExecutor
): Promise<Company | null> {
  const rows = (await exec(
    `select ${COLUMNS} from company order by id limit 1`
  )) as Company[];
  return rows[0] ?? null;
}

// Create the company if none exists, otherwise update the existing row. Keeps a
// single company per tenant and preserves its id across edits.
export async function upsertCompany(
  input: CompanyInput,
  exec: Executor = defaultExecutor
): Promise<Company> {
  const name = required(input.name, "name");
  const existing = await getCompany(exec);
  const params = [
    name,
    clean(input.address),
    clean(input.proprietor),
    clean(input.tin),
    clean(input.tel_no),
    clean(input.fax_no)
  ];

  if (existing) {
    const rows = await exec(
      `update company set
         name = $2, address = $3, proprietor = $4, tin = $5,
         tel_no = $6, fax_no = $7, updated_at = now()
       where id = $1
       returning ${COLUMNS}`,
      [existing.id, ...params]
    );
    return rows[0] as Company;
  }

  const rows = await exec(
    `insert into company
       (id, tenant_id, name, address, proprietor, tin, tel_no, fax_no)
     values ($1, 'fastrak', $2, $3, $4, $5, $6, $7)
     returning ${COLUMNS}`,
    [newId(), ...params]
  );
  return rows[0] as Company;
}
