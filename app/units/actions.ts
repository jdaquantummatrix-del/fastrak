"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createUnit, updateUnit } from "@/lib/units";

export async function createUnitAction(formData: FormData) {
  const unit = String(formData.get("unit") ?? "");
  await createUnit({ unit });
  revalidatePath("/units");
  redirect("/units");
}

export async function updateUnitAction(id: string, formData: FormData) {
  const unit = String(formData.get("unit") ?? "");
  await updateUnit(id, { unit });
  revalidatePath("/units");
  redirect("/units");
}
