"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createCustomer, updateCustomer, type CustomerInput } from "@/lib/customers";

function parse(formData: FormData): CustomerInput {
  const termsRaw = String(formData.get("terms_days") ?? "").trim();
  const terms = termsRaw === "" ? null : Number(termsRaw);
  return {
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? ""),
    terms_days: terms != null && Number.isFinite(terms) ? terms : null,
    address: String(formData.get("address") ?? ""),
    contact_person: String(formData.get("contact_person") ?? ""),
    mobile: String(formData.get("mobile") ?? ""),
    tel_no: String(formData.get("tel_no") ?? ""),
    fax_no: String(formData.get("fax_no") ?? ""),
    tin: String(formData.get("tin") ?? ""),
    remarks: String(formData.get("remarks") ?? "")
  };
}

export async function createCustomerAction(formData: FormData) {
  await createCustomer(parse(formData));
  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomerAction(id: string, formData: FormData) {
  await updateCustomer(id, parse(formData));
  revalidatePath("/customers");
  redirect("/customers");
}
