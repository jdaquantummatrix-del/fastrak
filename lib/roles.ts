// The vocabulary of access: the app's modules and the role presets that grant
// them. Mirrors QMDI's data-driven model — a role is just a convenient starting
// set of grants; an admin can override any individual module afterwards.
//
// A module key is the first path segment of a route ("/dr" -> "dr",
// "/reports/ar" -> "reports"). The dashboard ("/") and a user's own account
// ("/account") are always reachable and are not modules.

export type Access = "off" | "view" | "edit";

export type ModuleDef = { key: string; label: string; group: string };

// Every grantable module. `users` (Manage access) is intentionally NOT here —
// it is admin-only and gated by users.is_admin, never by a grant row.
export const MODULES: ModuleDef[] = [
  { key: "dr", label: "Delivery Receipts", group: "Sales" },
  { key: "ar", label: "Accounts Receivable", group: "Sales" },
  { key: "collections", label: "Collections", group: "Sales" },
  { key: "returns", label: "Returns", group: "Sales" },
  { key: "items", label: "Items", group: "Inventory" },
  { key: "inventory", label: "Stock", group: "Inventory" },
  { key: "po", label: "Purchase Orders", group: "Inventory" },
  { key: "customers", label: "Customers", group: "Contacts" },
  { key: "customer-types", label: "Customer Types", group: "Setup" },
  { key: "suppliers", label: "Suppliers", group: "Contacts" },
  { key: "reports", label: "Reports", group: "Reports" },
  { key: "units", label: "Units", group: "Setup" },
  { key: "categories", label: "Categories", group: "Setup" },
  { key: "brands", label: "Brands", group: "Setup" },
  { key: "settings", label: "Settings", group: "Setup" }
];

export const MODULE_KEYS = MODULES.map((m) => m.key);

export function moduleKeyForPath(pathname: string): string | null {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (!seg) return null; // "/" dashboard
  return MODULE_KEYS.includes(seg) ? seg : null;
}

export type RolePreset = {
  key: string;
  label: string;
  isAdmin: boolean;
  canSeePrices: boolean;
  // module key -> access; modules not listed default to "off".
  grants: Record<string, Access>;
};

function all(access: Access): Record<string, Access> {
  return Object.fromEntries(MODULE_KEYS.map((k) => [k, access]));
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    key: "admin",
    label: "Administrator",
    isAdmin: true,
    canSeePrices: true,
    grants: all("edit")
  },
  {
    key: "manager",
    label: "Manager",
    isAdmin: false,
    canSeePrices: true,
    grants: {
      ...all("view"),
      dr: "edit",
      ar: "edit",
      collections: "edit",
      returns: "edit",
      items: "edit",
      inventory: "edit",
      po: "edit",
      customers: "edit",
      suppliers: "edit"
    }
  },
  {
    key: "sales",
    label: "Sales",
    isAdmin: false,
    canSeePrices: true,
    grants: {
      dr: "edit",
      ar: "edit",
      collections: "edit",
      returns: "edit",
      customers: "edit",
      items: "view",
      inventory: "view",
      reports: "view"
    }
  },
  {
    key: "warehouse",
    label: "Warehouse",
    isAdmin: false,
    canSeePrices: false,
    grants: {
      items: "edit",
      inventory: "edit",
      po: "edit",
      dr: "view",
      suppliers: "view",
      reports: "view"
    }
  },
  {
    key: "viewer",
    label: "Viewer (read-only)",
    isAdmin: false,
    canSeePrices: false,
    grants: all("view")
  }
];

export function rolePreset(key: string): RolePreset | undefined {
  return ROLE_PRESETS.find((r) => r.key === key);
}
