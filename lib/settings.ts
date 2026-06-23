// Data module for the App settings table (fastrak appdflt.dbf): a key/value
// list of application defaults the legacy app reads. These rows are migrated
// from fastrak (keys are fixed); the app exposes read (list/get) + update of a
// setting's value. See db/schema/0008_app_settings.sql.
import { type Executor, defaultExecutor, clean } from "./reference";

export type Setting = {
  id: string;
  application: string | null;
  value: string | null;
  input_mask: string | null;
  format: string | null;
  control_width: number | null;
  data_type: string | null;
  message: string | null;
};

export type SettingInput = {
  value: string | null;
};

const COLUMNS =
  "id, application, value, input_mask, format, control_width, data_type, message";

export async function listSettings(
  exec: Executor = defaultExecutor
): Promise<Setting[]> {
  return (await exec(
    `select ${COLUMNS} from app_settings order by application nulls last, id`
  )) as Setting[];
}

export async function getSetting(
  id: string,
  exec: Executor = defaultExecutor
): Promise<Setting | null> {
  const rows = (await exec(`select ${COLUMNS} from app_settings where id = $1`, [
    id
  ])) as Setting[];
  return rows[0] ?? null;
}

// Update a setting's value (the only field a user edits; the key/metadata are
// fixed by the legacy app). Throws if the id is unknown.
export async function updateSetting(
  id: string,
  input: SettingInput,
  exec: Executor = defaultExecutor
): Promise<Setting> {
  const rows = await exec(
    `update app_settings set value = $2, updated_at = now()
      where id = $1
    returning ${COLUMNS}`,
    [id, clean(input.value)]
  );
  if (rows.length === 0) throw new Error(`setting ${id} not found`);
  return rows[0] as Setting;
}
