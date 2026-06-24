"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createCustomerType,
  updateCustomerType,
  deleteCustomerType
} from "@/lib/customer-types";

export async function createCustomerTypeAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const remarks = String(formData.get("remarks") ?? "");
  await createCustomerType({ name, remarks });
  revalidatePath("/customer-types");
  redirect("/customer-types");
}

export async function updateCustomerTypeAction(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const remarks = String(formData.get("remarks") ?? "");
  await updateCustomerType(id, { name, remarks });
  revalidatePath("/customer-types");
  redirect("/customer-types");
}

export async function deleteCustomerTypeAction(id: string) {
  await deleteCustomerType(id);
  revalidatePath("/customer-types");
  redirect("/customer-types");
}
