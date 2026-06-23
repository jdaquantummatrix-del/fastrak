"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createReturn,
  postReturn,
  unpostReturn,
  type ReturnInput,
  type ReturnLineInput
} from "@/lib/returns";

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
// line-price-0, line-disc-0, line-disc2-0, line-unit-0, line-good-0, ... The count is
// carried in `lineCount`. Rows without an item picked are dropped. `good` is the
// LGOOD flag (a checkbox -> "1" when resalable); only good lines restock on post.
function parseLines(formData: FormData): ReturnLineInput[] {
  const count = Number(str(formData, "lineCount").trim() || "0");
  const lines: ReturnLineInput[] = [];
  for (let i = 0; i < count; i++) {
    const itemId = str(formData, `line-item-${i}`).trim();
    if (itemId === "") continue;
    lines.push({
      item_id: itemId,
      qty: intOrNull(formData, `line-qty-${i}`),
      price: moneyOrNull(formData, `line-price-${i}`),
      disc: moneyOrNull(formData, `line-disc-${i}`),
      disc2: moneyOrNull(formData, `line-disc2-${i}`),
      unit: str(formData, `line-unit-${i}`),
      // a checked box submits both the hidden "0" and the checkbox "1"; treat the
      // line as good when any submitted value is "1".
      good: formData.getAll(`line-good-${i}`).some((v) => String(v) === "1")
    });
  }
  return lines;
}

function parse(formData: FormData): ReturnInput {
  return {
    return_date: str(formData, "return_date"),
    customer_id: str(formData, "customer_id"),
    dr_id: str(formData, "dr_id"),
    remarks: str(formData, "remarks"),
    lines: parseLines(formData)
  };
}

export async function createReturnAction(formData: FormData) {
  const ret = await createReturn(parse(formData));
  revalidatePath("/returns");
  redirect(`/returns/${ret.id}`);
}

export async function postReturnAction(id: string) {
  await postReturn(id);
  revalidatePath("/returns");
  revalidatePath(`/returns/${id}`);
  revalidatePath("/inventory");
  revalidatePath("/ar");
  redirect(`/returns/${id}`);
}

export async function unpostReturnAction(id: string) {
  await unpostReturn(id);
  revalidatePath("/returns");
  revalidatePath(`/returns/${id}`);
  revalidatePath("/inventory");
  revalidatePath("/ar");
  redirect(`/returns/${id}`);
}
