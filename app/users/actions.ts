"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/account";
import {
  createUser,
  setRole,
  setActive,
  setCanSeePrices,
  setGrant,
  resetPassword
} from "@/lib/users";
import { MODULE_KEYS, type Access } from "@/lib/roles";

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// Add a new person (admin only). On success, jump to their editor.
export async function createPersonAction(formData: FormData) {
  await requireAdmin();
  const input = {
    username: String(formData.get("username") ?? ""),
    name: String(formData.get("name") ?? ""),
    role: String(formData.get("role") ?? ""),
    password: String(formData.get("password") ?? "")
  };
  let id: string;
  try {
    const account = await createUser(input);
    id = account.id;
  } catch (e) {
    redirect(`/users?error=${encodeURIComponent(message(e))}`);
  }
  redirect(`/users/${id}`);
}

// Change a person's role. This RESETS their module grants to the role's preset.
export async function changeRoleAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");
  try {
    await setRole(id, role);
  } catch (e) {
    redirect(`/users/${id}?error=${encodeURIComponent(message(e))}`);
  }
  redirect(`/users/${id}?saved=role`);
}

// Save per-module access + the "can see prices" flag in one go.
export async function saveAccessAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  try {
    for (const key of MODULE_KEYS) {
      const raw = String(formData.get(`module_${key}`) ?? "off");
      const access: Access = raw === "edit" ? "edit" : raw === "view" ? "view" : "off";
      await setGrant(id, key, access);
    }
    await setCanSeePrices(id, formData.get("can_see_prices") === "1");
  } catch (e) {
    redirect(`/users/${id}?error=${encodeURIComponent(message(e))}`);
  }
  redirect(`/users/${id}?saved=access`);
}

export async function setActiveAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "1";
  try {
    await setActive(id, active);
  } catch (e) {
    redirect(`/users/${id}?error=${encodeURIComponent(message(e))}`);
  }
  redirect(`/users/${id}?saved=active`);
}

export async function resetPasswordAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    await resetPassword(id, password);
  } catch (e) {
    redirect(`/users/${id}?error=${encodeURIComponent(message(e))}`);
  }
  redirect(`/users/${id}?saved=password`);
}
