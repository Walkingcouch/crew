import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { OfflineIndicator } from "@/components/ui/OfflineIndicator";
import { SosButton } from "@/components/shared/SosButton";

export const metadata: Metadata = { manifest: "/manifest-field.json" };
export const viewport: Viewport = { themeColor: "#c47b0a" };

const TABS = [
  { href: "/field", label: "Today", icon: "📋" },
  { href: "/field/messages", label: "Messages", icon: "💬" },
  { href: "/field/settings", label: "Settings", icon: "⚙️" },
];

export default function FieldLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 pb-16 sm:pb-0">
      <OfflineIndicator />
      <AppHeader surface="field" />
      <main id="main-content">{children}</main>
      <SosButton />
      <BottomTabBar items={TABS} />
    </div>
  );
}
