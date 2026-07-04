import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { OfflineIndicator } from "@/components/ui/OfflineIndicator";

const TABS = [
  { href: "/customer", label: "Home", icon: "🏠" },
  { href: "/customer/bookings", label: "Bookings", icon: "📋" },
  { href: "/customer/messages", label: "Messages", icon: "💬" },
  { href: "/customer/notifications", label: "Alerts", icon: "🔔" },
  { href: "/customer/profile", label: "Profile", icon: "👤" },
];

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 pb-16 sm:pb-0">
      <OfflineIndicator />
      <AppHeader surface="customer" />
      <main id="main-content">{children}</main>
      <BottomTabBar items={TABS} />
    </div>
  );
}
