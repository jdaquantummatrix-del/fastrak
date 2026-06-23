"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { upsertCompany, type CompanyInput } from "@/lib/company";
import { updateSetting } from "@/lib/settings";

function parseCompany(formData: FormData): CompanyInput {
  return {
    name: String(formData.get("name") ?? ""),
    address: String(formData.get("address") ?? ""),
    proprietor: String(formData.get("proprietor") ?? ""),
    tin: String(formData.get("tin") ?? ""),
    tel_no: String(formData.get("tel_no") ?? ""),
    fax_no: String(formData.get("fax_no") ?? "")
  };
}

export async function saveCompanyAction(formData: FormData) {
  await upsertCompany(parseCompany(formData));
  revalidatePath("/settings");
  redirect("/settings");
}

export async function updateSettingAction(id: string, formData: FormData) {
  await updateSetting(id, { value: String(formData.get("value") ?? "") });
  revalidatePath("/settings");
  redirect("/settings");
}
