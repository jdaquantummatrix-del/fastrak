// Data module for the Unit reference table (fastrak unit.dbf).
import { type Executor, defaultExecutor, newId, required } from "./reference";

export type Unit = {
  id: string;
  unit: string | null;
};

export type UnitInput = {
  unit: string;
};

export async function listUnits(exec: Executor = defaultExecutor): Promise<Unit[]> {
  return (await exec(
    `select id, unit from units order by unit nulls last, id`
  )) as Unit[];
}

export async function createUnit(
  input: UnitInput,
  exec: Executor = defaultExecutor
): Promise<Unit> {
  const unit = required(input.unit, "unit");
  const id = newId();
  const rows = await exec(
    `insert into units (id, unit) values ($1, $2) returning id, unit`,
    [id, unit]
  );
  return rows[0] as Unit;
}

export async function updateUnit(
  id: string,
  input: UnitInput,
  exec: Executor = defaultExecutor
): Promise<Unit> {
  const unit = required(input.unit, "unit");
  const rows = await exec(
    `update units set unit = $2, updated_at = now()
      where id = $1 returning id, unit`,
    [id, unit]
  );
  if (rows.length === 0) throw new Error(`unit ${id} not found`);
  return rows[0] as Unit;
}

export async function getUnit(
  id: string,
  exec: Executor = defaultExecutor
): Promise<Unit | null> {
  const rows = (await exec(`select id, unit from units where id = $1`, [id])) as Unit[];
  return rows[0] ?? null;
}
