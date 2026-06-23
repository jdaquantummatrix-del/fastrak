"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createItem, updateItem, type ItemInput } from "@/lib/items";

// pack_size / critical are whole-unit counts -> truncate any fractional input,
// matching the count() coercion lib/po.ts and lib/inventory.ts use, so an entry
// like "48.9" is stored as 48 rather than a fraction the integer columns reject.
function intOrNull(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function moneyOrNull(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  return raw === "" ? null : raw;
}

function parse(formData: FormData): ItemInput {
  return {
    code: String(formData.get("code") ?? ""),
    description: String(formData.get("description") ?? ""),
    unit: String(formData.get("unit") ?? ""),
    unit2: String(formData.get("unit2") ?? ""),
    pack_size: intOrNull(formData, "pack_size"),
    base_cost: moneyOrNull(formData, "base_cost"),
    price: moneyOrNull(formData, "price"),
    retail: moneyOrNull(formData, "retail"),
    category_id: String(formData.get("category_id") ?? ""),
    brand_id: String(formData.get("brand_id") ?? ""),
    supplier_id: String(formData.get("supplier_id") ?? ""),
    inactive: formData.get("inactive") != null,
    critical: intOrNull(formData, "critical"),
    type: String(formData.get("type") ?? "")
  };
}

export async function createItemAction(formData: FormData) {
  await createItem(parse(formData));
  revalidatePath("/items");
  redirect("/items");
}

export async function updateItemAction(id: string, formData: FormData) {
  await updateItem(id, parse(formData));
  revalidatePath("/items");
  redirect("/items");
}
