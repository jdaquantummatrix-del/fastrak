// Server-only helpers to resolve "who is the current user" from the session
// cookie, and to gate pages/actions. Uses next/headers + the DB, so it runs in
// Node (Server Components / Server Actions) — never in Edge middleware.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, getSessionSecret } from "./auth";
import { getUserById, type Account } from "./users";

// The signed-in account, or null. Returns null for an expired/forged cookie, a
// deleted user, or a deactivated one (so disabling someone logs them out).
export async function getCurrentAccount(): Promise<Account | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value ?? "";
  const session = await verifySession(token, getSessionSecret());
  if (!session) return null;
  const account = await getUserById(session.sub);
  if (!account || !account.isActive) return null;
  return account;
}

export async function requireAccount(): Promise<Account> {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  return account;
}

// Gate an admin-only page or action. Non-admins are bounced to the dashboard.
export async function requireAdmin(): Promise<Account> {
  const account = await requireAccount();
  if (!account.isAdmin) redirect("/");
  return account;
}
