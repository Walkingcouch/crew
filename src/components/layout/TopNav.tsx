"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export interface NavItem {
  href: string;
  label: string;
}

/** Horizontal top-tab navigation for the desktop-first surfaces (Manager,
 * Supervisor, Command), used instead of the mobile BottomTabBar. */
export function TopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex gap-1 overflow-x-auto border-b border-neutral-200 bg-white px-4">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-4 py-3 text-sm font-medium",
              active ? "border-crew-green text-crew-green" : "border-transparent text-neutral-500 hover:text-crew-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
