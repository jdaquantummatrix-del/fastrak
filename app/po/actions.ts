"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createPO, receivePO, type POInput, type POLineInput } from "@/lib/po";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function intOrNull(formData: FormData, key: string): number | null {
  const raw = str(formData, key).trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function moneyOrNull(formData: FormData, key: string): string | null {
  const raw = str(formData, key).trim();
  return raw === "" ? null : raw;
}

// The line rows are submitted with indexed names: line-item-0, line-qty-0,
// line-cost-0, line-unit-0, ... The count is carried in `lineCount`. Rows
// without an item picked are dropped.
function parseLines(formData: FormData): POLineInput[] {
  const count = Number(str(formData, "lineCount").trim() || "0");
  const lines: POLineInput[] = [];
  for (let i = 0; i < count; i++) {
    const itemId = str(formData, `line-item-${i}`).trim();
    if (itemId === "") continue;
    lines.push({
      item_id: itemId,
      qty: intOrNull(formData, `line-qty-${i}`),
      base_cost: moneyOrNull(formData, `line-cost-${i}`),
      unit: str(formData, `line-unit-${i}`)
    });
  }
  return lines;
}

function parse(formData: FormData): POInput {
  return {
    po_no: str(formData, "po_no"),
    po_date: str(formData, "po_date"),
    supplier_id: str(formData, "supplier_id"),
    remarks: str(formData, "remarks"),
    lines: parseLines(formData)
  };
}

export async function createPOAction(formData: FormData) {
  const po = await createPO(parse(formData));
  revalidatePath("/po");
  redirect(`/po/${po.id}`);
}

export async function receivePOAction(id: string) {
  await receivePO(id);
  revalidatePath("/po");
  revalidatePath("/inventory");
  redirect(`/po/${id}`);
}
