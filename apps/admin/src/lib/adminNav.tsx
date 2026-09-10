import type { ReactNode } from "react";
import { AiRunsIcon, DashboardIcon, DumbbellIcon, MediaIcon, ProgramsIcon, UsersIcon } from "@mogd/ui";

/**
 * The six operational areas admin is scoped to (docs/ARCHITECTURE.md §20,
 * CLAUDE.md rule 10). Do not add more without updating those docs first.
 */
export interface AdminNavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { href: "/users", label: "Users", icon: <UsersIcon /> },
  { href: "/exercises", label: "Exercises", icon: <DumbbellIcon /> },
  { href: "/media", label: "Media", icon: <MediaIcon /> },
  { href: "/programs", label: "Programs", icon: <ProgramsIcon /> },
  { href: "/ai-runs", label: "AI Runs", icon: <AiRunsIcon /> },
];
