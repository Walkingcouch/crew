import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "You are offline",
};

// Served by the service worker as the offline fallback when the network
// is unavailable (see public/sw.js, wired in Phase 8). Deliberately has no
// links out: everything else needs a network connection anyway.
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Image src="/assets/logo_Crew.png" alt="Crew" width={48} height={48} />
      <h1 className="text-2xl font-extrabold text-crew-ink">You are offline</h1>
      <p className="max-w-sm text-neutral-500">
        Check your internet connection and try again. Anything you already opened stays available while you are
        offline.
      </p>
    </div>
  );
}
