"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@mogd/ui";
import { ADMIN_NAV_ITEMS } from "@/lib/adminNav";

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-zinc-800 p-4">
      {ADMIN_NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm",
              active ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-100",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
