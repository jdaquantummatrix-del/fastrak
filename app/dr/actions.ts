"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createDR,
  updateDR,
  postDR,
  cancelDR,
  type DRInput,
  type DRLineInput
} from "@/lib/dr";

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
// line-pcs-0, line-price-0, line-disc-0, line-disc2-0, line-unit-0, ... The count is
// carried in `lineCount`. Rows without an item picked are dropped. `pcs` is the
// piece quantity (qty2) fastrak's money math and inventory posting operate on; we
// default it to qty when the form leaves it blank.
function parseLines(formData: FormData): DRLineInput[] {
  const count = Number(str(formData, "lineCount").trim() || "0");
  const lines: DRLineInput[] = [];
  for (let i = 0; i < count; i++) {
    const itemId = str(formData, `line-item-${i}`).trim();
    if (itemId === "") continue;
    const qty = intOrNull(formData, `line-qty-${i}`);
    const pcs = intOrNull(formData, `line-pcs-${i}`);
    lines.push({
      item_id: itemId,
      qty,
      qty2: pcs ?? qty,
      price: moneyOrNull(formData, `line-price-${i}`),
      disc: moneyOrNull(formData, `line-disc-${i}`),
      disc2: moneyOrNull(formData, `line-disc2-${i}`),
      unit: str(formData, `line-unit-${i}`)
    });
  }
  return lines;
}

function parse(formData: FormData): DRInput {
  return {
    dr_no: str(formData, "dr_no"),
    dr_date: str(formData, "dr_date"),
    customer_id: str(formData, "customer_id"),
    address: str(formData, "address"),
    po_no: str(formData, "po_no"),
    terms_days: intOrNull(formData, "terms_days"),
    doc_disc: moneyOrNull(formData, "doc_disc"),
    doc_disc2: moneyOrNull(formData, "doc_disc2"),
    add_pct: moneyOrNull(formData, "add_pct"),
    remarks: str(formData, "remarks"),
    lines: parseLines(formData)
  };
}

export async function createDRAction(formData: FormData) {
  const dr = await createDR(parse(formData));
  revalidatePath("/dr");
  redirect(`/dr/${dr.id}`);
}

export async function updateDRAction(id: string, formData: FormData) {
  await updateDR(id, parse(formData));
  revalidatePath("/dr");
  revalidatePath(`/dr/${id}`);
  redirect(`/dr/${id}`);
}

export async function postDRAction(id: string) {
  await postDR(id);
  revalidatePath("/dr");
  revalidatePath(`/dr/${id}`);
  revalidatePath("/inventory");
  redirect(`/dr/${id}`);
}

export async function cancelDRAction(id: string) {
  await cancelDR(id);
  revalidatePath("/dr");
  revalidatePath(`/dr/${id}`);
  revalidatePath("/inventory");
  redirect(`/dr/${id}`);
}
