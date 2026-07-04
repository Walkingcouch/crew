"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Slide-in panel (mobile menu, filters). Same focus-trap/Escape contract
 * as Dialog, but anchored to an edge instead of centred. */
export function Sheet({
  open,
  onClose,
  side = "right",
  children,
  className,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right" | "bottom";
  children: ReactNode;
  className?: string;
  ariaLabel: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const sideClasses = {
    left: "left-0 top-0 h-full w-72",
    right: "right-0 top-0 h-full w-72",
    bottom: "bottom-0 left-0 w-full max-h-[80vh] rounded-t-2xl",
  }[side];

  return (
    <div className="fixed inset-0 z-[900] bg-black/50" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn("fixed bg-white p-5 shadow-xl overflow-y-auto", sideClasses, className)}
      >
        {children}
      </div>
    </div>
  );
}
