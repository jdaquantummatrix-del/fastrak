"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createBrand, updateBrand } from "@/lib/brands";

export async function createBrandAction(formData: FormData) {
  const brand = String(formData.get("brand") ?? "");
  const remarks = String(formData.get("remarks") ?? "");
  await createBrand({ brand, remarks });
  revalidatePath("/brands");
  redirect("/brands");
}

export async function updateBrandAction(id: string, formData: FormData) {
  const brand = String(formData.get("brand") ?? "");
  const remarks = String(formData.get("remarks") ?? "");
  await updateBrand(id, { brand, remarks });
  revalidatePath("/brands");
  redirect("/brands");
}
