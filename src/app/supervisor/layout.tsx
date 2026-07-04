import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { TopNav } from "@/components/layout/TopNav";
import { OfflineIndicator } from "@/components/ui/OfflineIndicator";

export const metadata: Metadata = { manifest: "/manifest-supervisor.json" };
export const viewport: Viewport = { themeColor: "#0e7d6b" };

const NAV_ITEMS = [
  { href: "/supervisor", label: "Job map" },
  { href: "/supervisor/approvals", label: "Approvals" },
  { href: "/supervisor/messages", label: "Messages" },
  { href: "/supervisor/settings", label: "Settings" },
];

export default function SupervisorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <OfflineIndicator />
      <AppHeader surface="supervisor" />
      <TopNav items={NAV_ITEMS} />
      <main id="main-content">{children}</main>
    </div>
  );
}
