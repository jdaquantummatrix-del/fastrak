"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupplier, updateSupplier, type SupplierInput } from "@/lib/suppliers";

function parse(formData: FormData): SupplierInput {
  const termsRaw = String(formData.get("terms_days") ?? "").trim();
  const terms = termsRaw === "" ? null : Number(termsRaw);
  return {
    name: String(formData.get("name") ?? ""),
    terms_days: terms != null && Number.isFinite(terms) ? terms : null,
    contact_person: String(formData.get("contact_person") ?? ""),
    tel_no: String(formData.get("tel_no") ?? ""),
    fax_no: String(formData.get("fax_no") ?? ""),
    address: String(formData.get("address") ?? ""),
    is_local: formData.get("is_local") != null,
    remarks: String(formData.get("remarks") ?? "")
  };
}

export async function createSupplierAction(formData: FormData) {
  await createSupplier(parse(formData));
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function updateSupplierAction(id: string, formData: FormData) {
  await updateSupplier(id, parse(formData));
  revalidatePath("/suppliers");
  redirect("/suppliers");
}
