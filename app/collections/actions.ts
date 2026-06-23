"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  recordCollection,
  type CollectionInput,
  type CollectionLineInput
} from "@/lib/collections";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function moneyOrNull(formData: FormData, key: string): string | null {
  const raw = str(formData, key).trim();
  return raw === "" ? null : raw;
}

// The payment lines are submitted with indexed names: line-ar-0, line-amount-0,
// line-ar-1, line-amount-1, … The count is carried in `lineCount`. A line is included
// only when its A/R row is selected (line-ar-N non-blank) AND a positive amount is
// entered — an unchecked / zero row applies nothing, so we drop it.
function parseLines(formData: FormData): CollectionLineInput[] {
  const count = Number(str(formData, "lineCount").trim() || "0");
  const lines: CollectionLineInput[] = [];
  for (let i = 0; i < count; i++) {
    const arId = str(formData, `line-ar-${i}`).trim();
    if (arId === "") continue;
    const amount = moneyOrNull(formData, `line-amount-${i}`);
    if (amount == null || Number(amount) <= 0) continue;
    lines.push({ ar_id: arId, amount });
  }
  return lines;
}

function parse(formData: FormData): CollectionInput {
  return {
    col_date: str(formData, "col_date"),
    customer_id: str(formData, "customer_id"),
    remarks: str(formData, "remarks"),
    lines: parseLines(formData)
  };
}

export async function createCollectionAction(formData: FormData) {
  const col = await recordCollection(parse(formData));
  revalidatePath("/collections");
  // Recording a collection reduced the targeted receivables — refresh A/R too.
  revalidatePath("/ar");
  redirect(`/collections/${col.id}`);
}
