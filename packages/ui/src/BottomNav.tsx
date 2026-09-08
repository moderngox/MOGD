import { cn } from "./cn";
import type { SidebarNavItem } from "./SidebarNav";

export interface BottomNavProps {
  items: SidebarNavItem[];
  className?: string;
}

/**
 * design.md's "confirmed direction": mobile replaces the sidebar with a
 * bottom tab bar rather than a responsive sidebar. Shown below `md`; pair
 * with `SidebarNav` (hidden below `md`) for the same item list.
 */
export function BottomNav({ items, className }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] md:hidden",
        className,
      )}
    >
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium",
            item.active ? "text-accent" : "text-fg-secondary",
          )}
        >
          {item.icon && <span className="h-5 w-5">{item.icon}</span>}
          {item.label}
        </a>
      ))}
    </nav>
  );
}
