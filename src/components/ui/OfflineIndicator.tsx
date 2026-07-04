"use client";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineIndicator() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      className="bg-crew-amber px-4 py-2 text-center text-sm font-medium text-white"
    >
      You are offline. Some features may not be available.
    </div>
  );
}
