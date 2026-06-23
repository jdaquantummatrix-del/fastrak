"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createCategory, updateCategory } from "@/lib/categories";

export async function createCategoryAction(formData: FormData) {
  const category = String(formData.get("category") ?? "");
  const remarks = String(formData.get("remarks") ?? "");
  await createCategory({ category, remarks });
  revalidatePath("/categories");
  redirect("/categories");
}

export async function updateCategoryAction(id: string, formData: FormData) {
  const category = String(formData.get("category") ?? "");
  const remarks = String(formData.get("remarks") ?? "");
  await updateCategory(id, { category, remarks });
  revalidatePath("/categories");
  redirect("/categories");
}
