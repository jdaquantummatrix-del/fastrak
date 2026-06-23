import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import AppShell from "./_components/app-shell";
import { getCurrentAccount } from "@/lib/account";
import { allowedModuleKeys } from "@/lib/users";
import { moduleKeyForPath } from "@/lib/roles";

export const metadata: Metadata = {
  title: "fastrak — Project Kenny",
  description: "Web rebuild of Kennard's fastrak distribution system"
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // The middleware forwards the path (x-pathname) only for authenticated
  // requests. On /login (or static) it's absent — render the shell with no
  // account, which shows the page bare (no sidebar).
  const pathname = (await headers()).get("x-pathname") || "";

  let account: { username: string; name: string | null; isAdmin: boolean } | null =
    null;
  let allowed: string[] = [];

  if (pathname && pathname !== "/login") {
    const me = await getCurrentAccount();
    if (!me) redirect("/login"); // belt-and-braces; middleware already gates this
    const set = await allowedModuleKeys(me);
    allowed = [...set];

    // Per-module access: if this path belongs to a module the user can't reach,
    // send them to the dashboard (always available to any signed-in user).
    const mod = moduleKeyForPath(pathname);
    if (mod && !me.isAdmin && !set.has(mod)) redirect("/");

    account = { username: me.username, name: me.name, isAdmin: me.isAdmin };
  }

  return (
    <html lang="en">
      <body>
        <AppShell account={account} allowed={allowed}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
