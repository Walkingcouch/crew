import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { TopNav } from "@/components/layout/TopNav";

const NAV_ITEMS = [
  { href: "/command", label: "Metrics" },
  { href: "/command/bookings", label: "Bookings & Escrow" },
  { href: "/command/verification", label: "Verification queue" },
  { href: "/command/users", label: "Users & Orgs" },
  { href: "/command/reports", label: "Community reports" },
  { href: "/command/beta-allowlist", label: "Beta allowlist" },
  { href: "/command/login-activity", label: "Login activity" },
];

export default function CommandLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <AppHeader surface="command" />
      <TopNav items={NAV_ITEMS} />
      <main id="main-content">{children}</main>
    </div>
  );
}
