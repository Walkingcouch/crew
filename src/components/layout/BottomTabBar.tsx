"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export interface TabItem {
  href: string;
  label: string;
  icon: string;
}

/** Mobile bottom tab bar, shared by the Customer, Pro and Field surfaces
 * (each passes its own set of primary sections). Hidden on larger
 * viewports where the surface uses its header/sidebar navigation instead. */
export function BottomTabBar({ items }: { items: TabItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-neutral-200 bg-white sm:hidden"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium",
              active ? "text-crew-green" : "text-neutral-400",
            )}
          >
            <span aria-hidden="true" className="text-lg">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
