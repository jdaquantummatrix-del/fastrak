"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import PageTour from "./page-tour";
import { moduleKeyForPath } from "@/lib/roles";
import { logoutAction } from "../login/actions";

// Minimal Feather-style line icons, kept inline so there is no icon dependency.
const ICONS: Record<string, string> = {
  dashboard:
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  dr: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8"/>',
  ar: '<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  collections:
    '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  returns: '<path d="M3 2v6h6"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L3 8"/>',
  items:
    '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
  stock: '<path d="M12 2 2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  po: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  customers:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
  suppliers:
    '<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="1.5"/><circle cx="18.5" cy="18.5" r="1.5"/>',
  units: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  categories:
    '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  brands:
    '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.2"/>',
  settings:
    '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  reports: '<path d="M18 20V10M12 20V4M6 20v-6M3 20h18"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'
};

function Icon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? "" }}
    />
  );
}

type Item = { href: string; label: string; icon: string; adminOnly?: boolean };
const GROUPS: { title?: string; items: Item[] }[] = [
  { items: [{ href: "/", label: "Dashboard", icon: "dashboard" }] },
  {
    title: "Sales",
    items: [
      { href: "/dr", label: "Delivery Receipts", icon: "dr" },
      { href: "/ar", label: "Accounts Receivable", icon: "ar" },
      { href: "/collections", label: "Collections", icon: "collections" },
      { href: "/returns", label: "Returns", icon: "returns" }
    ]
  },
  {
    title: "Inventory",
    items: [
      { href: "/items", label: "Items", icon: "items" },
      { href: "/inventory", label: "Stock", icon: "stock" },
      { href: "/po", label: "Purchase Orders", icon: "po" }
    ]
  },
  {
    title: "Contacts",
    items: [
      { href: "/customers", label: "Customers", icon: "customers" },
      { href: "/suppliers", label: "Suppliers", icon: "suppliers" }
    ]
  },
  {
    title: "Reports",
    items: [
      { href: "/reports/ar", label: "A/R Statement", icon: "reports" },
      { href: "/reports/inventory", label: "Inventory Report", icon: "reports" }
    ]
  },
  {
    title: "Setup",
    items: [
      { href: "/units", label: "Units", icon: "units" },
      { href: "/categories", label: "Categories", icon: "categories" },
      { href: "/brands", label: "Brands", icon: "brands" },
      { href: "/settings", label: "Settings", icon: "settings" },
      { href: "/users", label: "Manage access", icon: "shield", adminOnly: true }
    ]
  }
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

type Account = { username: string; name: string | null; isAdmin: boolean };

export default function AppShell({
  children,
  account,
  allowed
}: {
  children: ReactNode;
  account: Account | null;
  allowed: string[];
}) {
  const pathname = usePathname() || "/";
  // Mobile nav drawer (the fixed sidebar slides in behind a hamburger on phones).
  const [menuOpen, setMenuOpen] = useState(false);

  // The login screen (and any unauthenticated view) stands alone — no sidebar.
  if (!account) return <>{children}</>;

  const allowedSet = new Set(allowed);
  const canSee = (item: Item): boolean => {
    if (item.href === "/") return true;
    if (item.adminOnly) return account.isAdmin;
    if (account.isAdmin) return true;
    const key = moduleKeyForPath(item.href);
    return key ? allowedSet.has(key) : true;
  };
  const close = () => setMenuOpen(false);

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="burger"
          type="button"
          aria-label="Open menu"
          onClick={() => setMenuOpen(true)}
        >
          <Icon name="menu" />
        </button>
        <div className="brand-name">fastrak</div>
      </header>

      {menuOpen ? <div className="scrim" onClick={close} /> : null}

      <aside className={"sidebar" + (menuOpen ? " open" : "")}>
        <div className="brand">
          <div className="brand-mark">f</div>
          <div>
            <div className="brand-name">fastrak</div>
            <div className="brand-sub">Project Kenny</div>
          </div>
        </div>

        <nav className="nav">
          {GROUPS.map((group, i) => {
            const items = group.items.filter(canSee);
            if (items.length === 0) return null;
            return (
              <div key={i}>
                {group.title ? <div className="nav-section">{group.title}</div> : null}
                {items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={close}
                    className={
                      "nav-link" + (isActive(pathname, item.href) ? " active" : "")
                    }
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </a>
                ))}
              </div>
            );
          })}

          <div className="nav-spacer" />

          <a
            className={"nav-link" + (isActive(pathname, "/account") ? " active" : "")}
            href="/account"
            onClick={close}
          >
            <Icon name="user" />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {account.name || account.username}
            </span>
          </a>
          <form action={logoutAction}>
            <button className="nav-link nav-signout" type="submit">
              <Icon name="logout" />
              Sign out
            </button>
          </form>
        </nav>
      </aside>

      <div className="content">{children}</div>
      <PageTour />
    </div>
  );
}
