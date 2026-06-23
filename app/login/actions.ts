"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  getSessionSecret
} from "@/lib/auth";
import { getUserByUsername, recordLogin } from "@/lib/users";
import { verifyPassword } from "@/lib/password";

// Server Action for the username + password login form (app/login/page.tsx).
// On valid credentials we mint a session token carrying the user's id and drop
// it as a signed, httpOnly cookie; the middleware checks that cookie on every
// request. On any failure we bounce back to /login?error=1 — the message is
// deliberately generic ("wrong username or password") so it never reveals
// whether a username exists.
export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNext(String(formData.get("next") ?? "/"));

  const account = await getUserByUsername(username);
  if (
    !account ||
    !account.isActive ||
    !verifyPassword(password, account.passwordHash)
  ) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const token = await signSession(getSessionSecret(), account.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  });

  await recordLogin(account.id);
  redirect(next);
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

// Only allow same-site, absolute-path redirects (must start with a single "/").
// Blocks "//evil.com" and "https://evil.com" open-redirects.
function sanitizeNext(next: string): string {
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
