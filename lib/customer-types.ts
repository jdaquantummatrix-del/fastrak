// Data module for the Customer Type reference table (customer_types). Mirrors
// the Category/Brand/Unit pattern: a small managed lookup so a customer's Type
// is picked from a list instead of free text. Pre-seeded Wholesale / Retail /
// Distributor (see db/schema/0023_customer_types.sql).
import {
  type Executor,
  defaultExecutor,
  newId,
  required,
  clean
} from "./reference";

export type CustomerType = {
  id: string;
  name: string | null;
  remarks: string | null;
};

export type CustomerTypeInput = {
  name: string;
  remarks?: string | null;
};

// Map the unique-name index violation to a friendly, predictable error so the
// caller (and tests) don't have to know Postgres' constraint name.
function isUniqueViolation(e: unknown): boolean {
  if (e && typeof e === "object") {
    const err = e as { code?: string; message?: string };
    if (err.code === "23505") return true;
    if (typeof err.message === "string" && /unique|duplicate/i.test(err.message)) {
      return true;
    }
  }
  return false;
}

export async function listCustomerTypes(
  exec: Executor = defaultExecutor
): Promise<CustomerType[]> {
  return (await exec(
    `select id, name, remarks from customer_types order by name nulls last, id`
  )) as CustomerType[];
}

export async function getCustomerType(
  id: string,
  exec: Executor = defaultExecutor
): Promise<CustomerType | null> {
  const rows = (await exec(
    `select id, name, remarks from customer_types where id = $1`,
    [id]
  )) as CustomerType[];
  return rows[0] ?? null;
}

export async function createCustomerType(
  input: CustomerTypeInput,
  exec: Executor = defaultExecutor
): Promise<CustomerType> {
  const name = required(input.name, "name");
  const id = newId();
  try {
    const rows = await exec(
      `insert into customer_types (id, name, remarks)
         values ($1, $2, $3)
       returning id, name, remarks`,
      [id, name, clean(input.remarks)]
    );
    return rows[0] as CustomerType;
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new Error(`customer type "${name}" already exists`);
    }
    throw e;
  }
}

export async function updateCustomerType(
  id: string,
  input: CustomerTypeInput,
  exec: Executor = defaultExecutor
): Promise<CustomerType> {
  const name = required(input.name, "name");
  try {
    const rows = await exec(
      `update customer_types set name = $2, remarks = $3, updated_at = now()
        where id = $1
      returning id, name, remarks`,
      [id, name, clean(input.remarks)]
    );
    if (rows.length === 0) throw new Error(`customer type ${id} not found`);
    return rows[0] as CustomerType;
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new Error(`customer type "${name}" already exists`);
    }
    throw e;
  }
}

export async function deleteCustomerType(
  id: string,
  exec: Executor = defaultExecutor
): Promise<void> {
  const rows = await exec(
    `delete from customer_types where id = $1 returning id`,
    [id]
  );
  if (rows.length === 0) throw new Error(`customer type ${id} not found`);
}
