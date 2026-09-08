import type { ReactNode } from "react";
import { cn } from "./cn";

export interface SidebarNavItem {
  href: string;
  label: string;
  active?: boolean;
  icon?: ReactNode;
}

export interface SidebarNavProps {
  items: SidebarNavItem[];
  homeHref?: string;
  className?: string;
}

/**
 * design.md section 2 (App shell). Plain anchors rather than next/link —
 * this package has no framework dependency beyond react.
 */
export function SidebarNav({ items, homeHref = "/dashboard", className }: SidebarNavProps) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "hidden w-56 flex-none flex-col gap-6 border-r border-border bg-bg p-5 md:flex",
        className,
      )}
    >
      <div className="flex flex-col gap-3">
        <a
          href={homeHref}
          aria-label="MOGD home"
          className="inline-flex items-start font-display text-3xl tracking-[.18em] text-fg"
        >
          MOG<span className="ml-[-3px] text-base leading-none">D</span>
        </a>
        <span aria-hidden="true" className="block h-0.5 w-7 bg-accent" />
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.label}>
            <a
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                item.active ? "text-fg-secondary-alt" : "text-fg-secondary hover:text-fg-secondary-alt",
              )}
            >
              {item.icon ? (
                <span className={cn("h-4 w-4", item.active ? "text-accent" : "text-fg-muted")}>{item.icon}</span>
              ) : (
                <span
                  aria-hidden="true"
                  className={cn("h-1.5 w-1.5 rounded-full", item.active ? "bg-accent" : "bg-transparent")}
                />
              )}
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
