import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { TopNav } from "@/components/layout/TopNav";
import { OfflineIndicator } from "@/components/ui/OfflineIndicator";
import { requireSurfaceAccess } from "@/lib/supabase/require-surface";

export const metadata: Metadata = { manifest: "/manifest-manager.json" };
export const viewport: Viewport = { themeColor: "#5b2d8e" };

const NAV_ITEMS = [
  { href: "/manager", label: "Team" },
  { href: "/manager/earnings", label: "Org earnings" },
  { href: "/manager/onboarding", label: "Org verification" },
  { href: "/manager/messages", label: "Messages" },
  { href: "/manager/settings", label: "Settings" },
];

export default async function ManagerLayout({ children }: { children: ReactNode }) {
  await requireSurfaceAccess("manager");
  return (
    <div className="min-h-screen bg-neutral-50">
      <OfflineIndicator />
      <AppHeader surface="manager" />
      <TopNav items={NAV_ITEMS} />
      <main id="main-content">{children}</main>
    </div>
  );
}
