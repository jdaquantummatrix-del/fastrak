"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  recordMovement,
  type MovementInput,
  type RefType
} from "@/lib/inventory";

const REF_TYPES: RefType[] = ["po", "dr", "dscrp", "return"];

function intOrNull(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function refType(formData: FormData): RefType | null {
  const raw = str(formData, "refType").trim();
  return (REF_TYPES as string[]).includes(raw) ? (raw as RefType) : null;
}

function parse(formData: FormData): MovementInput {
  return {
    itemId: str(formData, "itemId").trim(),
    in: intOrNull(formData, "in"),
    out: intOrNull(formData, "out"),
    refType: refType(formData),
    refId: str(formData, "refId"),
    refNo: str(formData, "refNo"),
    name: str(formData, "name"),
    date: str(formData, "date")
  };
}

export async function recordMovementAction(formData: FormData) {
  await recordMovement(parse(formData));
  revalidatePath("/inventory");
  redirect("/inventory");
}
