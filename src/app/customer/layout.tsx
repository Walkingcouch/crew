import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { OfflineIndicator } from "@/components/ui/OfflineIndicator";
import { requireSurfaceAccess } from "@/lib/supabase/require-surface";

export const metadata: Metadata = { manifest: "/manifest-customer.json" };
export const viewport: Viewport = { themeColor: "#1a4d33" };

const TABS = [
  { href: "/customer", label: "Home", icon: "🏠" },
  { href: "/customer/bookings", label: "Bookings", icon: "📋" },
  { href: "/customer/messages", label: "Messages", icon: "💬" },
  { href: "/customer/notifications", label: "Alerts", icon: "🔔" },
  { href: "/customer/profile", label: "Profile", icon: "👤" },
];

export default async function CustomerLayout({ children }: { children: ReactNode }) {
  await requireSurfaceAccess("customer");
  return (
    <div className="min-h-screen bg-neutral-50 pb-16 sm:pb-0">
      <OfflineIndicator />
      <AppHeader surface="customer" />
      <main id="main-content">{children}</main>
      <BottomTabBar items={TABS} />
    </div>
  );
}
