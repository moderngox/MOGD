"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@mogd/ui";
import { ADMIN_NAV_ITEMS } from "@/lib/adminNav";

/** Mobile/tablet equivalent of AdminSidebar (design.md's mobile-first shell). */
export function AdminBottomNav() {
  const pathname = usePathname();

  const items = ADMIN_NAV_ITEMS.map((item) => ({
    href: item.href,
    label: item.label,
    icon: item.icon,
    active: pathname === item.href || pathname.startsWith(`${item.href}/`),
  }));

  return <BottomNav items={items} />;
}
