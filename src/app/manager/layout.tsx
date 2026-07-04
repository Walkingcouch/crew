import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { TopNav } from "@/components/layout/TopNav";
import { OfflineIndicator } from "@/components/ui/OfflineIndicator";

const NAV_ITEMS = [
  { href: "/manager", label: "Team" },
  { href: "/manager/earnings", label: "Org earnings" },
  { href: "/manager/onboarding", label: "Org verification" },
  { href: "/manager/messages", label: "Messages" },
  { href: "/manager/settings", label: "Settings" },
];

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <OfflineIndicator />
      <AppHeader surface="manager" />
      <TopNav items={NAV_ITEMS} />
      <main id="main-content">{children}</main>
    </div>
  );
}
