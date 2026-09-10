"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, Wordmark } from "@mogd/ui";
import { ADMIN_NAV_ITEMS } from "@/lib/adminNav";

/**
 * Same visual language as @mogd/ui's SidebarNav (design.md section 2 "App
 * shell"): Wordmark, then an icon+label nav list, accent icon + brighter
 * text for the active item. Kept as a local next/link-based component
 * (rather than the framework-free SidebarNav) so the active state is driven
 * by usePathname's prefix match — every admin route nests under one of
 * these six hrefs (e.g. /exercises/[id]).
 */
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin"
      className="hidden w-56 flex-none flex-col gap-6 border-r border-border bg-bg p-5 md:flex"
    >
      <Wordmark href="/dashboard" />
      <ul className="flex flex-col gap-1">
        {ADMIN_NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                  active ? "text-fg-secondary-alt" : "text-fg-secondary hover:text-fg-secondary-alt",
                )}
              >
                <span className={cn("h-4 w-4", active ? "text-accent" : "text-fg-muted")}>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
