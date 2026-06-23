"use server";

import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/account";
import { getUserByUsername, resetPassword } from "@/lib/users";
import { verifyPassword } from "@/lib/password";

// A user changes their OWN password: must prove the current one first.
export async function changeMyPasswordAction(formData: FormData) {
  const me = await requireAccount();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const full = await getUserByUsername(me.username);
  if (!full || !verifyPassword(current, full.passwordHash)) {
    redirect("/account?error=current");
  }
  if (next.length < 4) redirect("/account?error=short");
  if (next !== confirm) redirect("/account?error=match");

  await resetPassword(me.id, next);
  redirect("/account?saved=1");
}
