/**
 * The six operational areas admin is scoped to (docs/ARCHITECTURE.md §20,
 * CLAUDE.md rule 10). Do not add more without updating those docs first.
 */
export interface AdminNavItem {
  href: string;
  label: string;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/users", label: "Users" },
  { href: "/exercises", label: "Exercises" },
  { href: "/media", label: "Media" },
  { href: "/programs", label: "Programs" },
  { href: "/ai-runs", label: "AI Runs" },
];
