"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  passwordMatches,
  signSession,
  getSessionSecret
} from "@/lib/auth";

// Server Action for the shared-password login form (app/login/page.tsx).
// On a correct password we mint a signed session token and drop it as a
// signed, httpOnly cookie; the middleware checks that cookie on every request.
// On a wrong password we bounce back to /login?error=1 (no detail leaked).
//
// `next` is the path the user was originally heading to before the gate sent
// them to /login — we send them back there after a successful login.
export async function loginAction(formData: FormData) {
  const submitted = String(formData.get("password") ?? "");
  const next = sanitizeNext(String(formData.get("next") ?? "/"));

  const configured = process.env.APP_PASSWORD ?? "";
  if (!passwordMatches(submitted, configured)) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const token = await signSession(getSessionSecret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  });

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
