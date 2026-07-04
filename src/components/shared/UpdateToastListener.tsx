"use client";

import { useServiceWorker } from "@/hooks/useServiceWorker";

/**
 * Registers the service worker once at the app root and shows a small
 * persistent banner, not the generic auto-dismissing Toast, only when
 * useServiceWorker confirms a genuinely new version is waiting (never on
 * first install, see the hook's own comment). An update prompt needs to
 * stay on screen until the user acts, which the shared 4-second Toast
 * doesn't support and wasn't worth changing for every other call site.
 */
export function UpdateToastListener() {
  const { updateAvailable, applyUpdate } = useServiceWorker();

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[1100] flex items-center justify-between gap-3 bg-crew-ink px-4 py-3 text-sm text-white"
    >
      <span>A new version of Crew is available.</span>
      <button
        type="button"
        onClick={applyUpdate}
        className="shrink-0 rounded-full bg-white px-3 py-1.5 font-medium text-crew-ink"
      >
        Refresh
      </button>
    </div>
  );
}
