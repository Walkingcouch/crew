import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { OfflineIndicator } from "@/components/ui/OfflineIndicator";
import { SosButton } from "@/components/shared/SosButton";
import { requireSurfaceAccess } from "@/lib/supabase/require-surface";

export const metadata: Metadata = { manifest: "/manifest-pro.json" };
export const viewport: Viewport = { themeColor: "#1e5aa8" };

const TABS = [
  { href: "/pro", label: "Jobs", icon: "🧰" },
  { href: "/pro/earnings", label: "Earnings", icon: "💰" },
  { href: "/pro/messages", label: "Messages", icon: "💬" },
  { href: "/pro/credentials", label: "Credentials", icon: "🪪" },
  { href: "/pro/settings", label: "Settings", icon: "⚙️" },
];

export default async function ProLayout({ children }: { children: ReactNode }) {
  await requireSurfaceAccess("pro");
  return (
    <div className="min-h-screen bg-neutral-50 pb-16 sm:pb-0">
      <OfflineIndicator />
      <AppHeader surface="pro" />
      <main id="main-content">{children}</main>
      <SosButton />
      <BottomTabBar items={TABS} />
    </div>
  );
}
