"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/contractors", label: "For Contractors" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/blog", label: "Blog" },
  { href: "/apps", label: "Apps" },
];

export function MarketingHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-crew-green">
          <Image src="/assets/logo_Crew.png" alt="Crew" width={32} height={32} priority />
          <span>Crew</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-sm font-medium text-neutral-600 hover:text-crew-green",
                  active && "text-crew-green font-semibold",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="text-sm font-medium text-crew-ink hover:text-crew-green">
            Sign in
          </Link>
          <Link
            href="/login?mode=signup"
            className="rounded-full bg-crew-green px-4 py-2 text-sm font-semibold text-white hover:bg-crew-green-light"
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label="Open menu"
          onClick={() => setMenuOpen(true)}
          className="rounded-lg p-2 md:hidden"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} side="right" ariaLabel="Main menu">
        <nav id="mobile-nav" aria-label="Mobile navigation" className="flex flex-col gap-4">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="text-base font-medium text-crew-ink">
              {item.label}
            </Link>
          ))}
          <hr className="border-neutral-200" />
          <Link href="/login" onClick={() => setMenuOpen(false)} className="text-base font-medium text-crew-ink">
            Sign in
          </Link>
          <Link
            href="/login?mode=signup"
            onClick={() => setMenuOpen(false)}
            className="rounded-full bg-crew-green px-4 py-2 text-center text-sm font-semibold text-white"
          >
            Get started
          </Link>
        </nav>
      </Sheet>
    </header>
  );
}
