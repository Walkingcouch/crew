"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { cn } from "@/lib/cn";

export type Surface = "customer" | "pro" | "manager" | "field" | "supervisor" | "command";

const SURFACE_NAME: Record<Surface, string> = {
  customer: "Crew",
  pro: "Crew Pro",
  manager: "Crew Manager",
  field: "Crew Field",
  supervisor: "Crew Supervisor",
  command: "Crew Command",
};

const SURFACE_THEME: Record<Surface, string> = {
  customer: "bg-role-customer",
  pro: "bg-role-pro",
  manager: "bg-role-manager",
  field: "bg-role-field",
  supervisor: "bg-role-supervisor",
  command: "bg-role-command",
};

const SURFACE_HOME: Record<Surface, string> = {
  customer: "/customer",
  pro: "/pro",
  manager: "/manager",
  field: "/field",
  supervisor: "/supervisor",
  command: "/command",
};

export function AppHeader({ surface }: { surface: Surface }) {
  const router = useRouter();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className={cn("sticky top-0 z-40 text-white", SURFACE_THEME[surface])}>
      <div className="flex items-center justify-between px-4 py-3">
        <Link href={SURFACE_HOME[surface]} className="flex items-center gap-2 font-bold">
          <Image src="/assets/logo_Crew.png" alt="" width={28} height={28} aria-hidden="true" />
          <span>{SURFACE_NAME[surface]}</span>
        </Link>

        <div className="flex items-center gap-1">
          {canInstall && (
            <button
              type="button"
              onClick={promptInstall}
              className="rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
            >
              Install
            </button>
          )}

          <NotificationBell />

          <div className="relative">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-label="User menu"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-full p-2 hover:bg-white/10"
            >
              <span aria-hidden="true">👤</span>
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-44 rounded-xl2 border border-neutral-200 bg-white py-1 text-crew-ink shadow-lg"
              >
                <Link role="menuitem" href={`${SURFACE_HOME[surface]}/profile`} className="block px-4 py-2 text-sm hover:bg-neutral-50">
                  Profile
                </Link>
                <Link role="menuitem" href={`${SURFACE_HOME[surface]}/settings`} className="block px-4 py-2 text-sm hover:bg-neutral-50">
                  Settings
                </Link>
                <button
                  role="menuitem"
                  type="button"
                  onClick={signOut}
                  className="block w-full px-4 py-2 text-left text-sm text-crew-red hover:bg-neutral-50"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
