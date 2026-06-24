import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DM_Mono, Inter, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import AppShell from "./_components/app-shell";
import ThemeSwitcher from "./_components/theme-switcher";
import { getCurrentAccount } from "@/lib/account";
import { allowedModuleKeys } from "@/lib/users";
import { moduleKeyForPath } from "@/lib/roles";

// Retro type system. A clean sans for body/headings (readability first), a
// monospace for the receipt/terminal labels, kickers, badges and table numbers,
// and ONE retro slab/display face used only for the brand wordmark. Each is
// exposed as a CSS variable so globals.css can reference it in the font stacks;
// every face has a system fallback so the design degrades gracefully.
const sans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans"
});
const mono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono"
});
const display = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "fastrak",
  description: "fastrak — wholesale distribution system"
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
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${display.variable}`}
    >
      <body>
        <AppShell account={account} allowed={allowed}>
          {children}
        </AppShell>
        {process.env.NODE_ENV !== "production" ? <ThemeSwitcher /> : null}
      </body>
    </html>
  );
}
