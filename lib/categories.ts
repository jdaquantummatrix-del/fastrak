// Data module for the Category reference table (fastrak category.dbf).
import {
  type Executor,
  defaultExecutor,
  newId,
  required,
  clean
} from "./reference";

export type Category = {
  id: string;
  category: string | null;
  remarks: string | null;
};

export type CategoryInput = {
  category: string;
  remarks?: string | null;
};

export async function listCategories(
  exec: Executor = defaultExecutor
): Promise<Category[]> {
  return (await exec(
    `select id, category, remarks from categories order by category nulls last, id`
  )) as Category[];
}

export async function createCategory(
  input: CategoryInput,
  exec: Executor = defaultExecutor
): Promise<Category> {
  const category = required(input.category, "category");
  const id = newId();
  const rows = await exec(
    `insert into categories (id, category, remarks)
       values ($1, $2, $3)
     returning id, category, remarks`,
    [id, category, clean(input.remarks)]
  );
  return rows[0] as Category;
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
  exec: Executor = defaultExecutor
): Promise<Category> {
  const category = required(input.category, "category");
  const rows = await exec(
    `update categories set category = $2, remarks = $3, updated_at = now()
      where id = $1
    returning id, category, remarks`,
    [id, category, clean(input.remarks)]
  );
  if (rows.length === 0) throw new Error(`category ${id} not found`);
  return rows[0] as Category;
}

export async function getCategory(
  id: string,
  exec: Executor = defaultExecutor
): Promise<Category | null> {
  const rows = (await exec(
    `select id, category, remarks from categories where id = $1`,
    [id]
  )) as Category[];
  return rows[0] ?? null;
}
