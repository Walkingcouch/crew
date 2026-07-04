"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { authHeader } from "@/lib/api-client";

/** Fixed red SOS button: confirm dialog, tel:000, and an admin alert with
 * geolocation if the browser grants permission. Shared by Pro, Field and
 * Supervisor, the three surfaces where a worker might be alone on a job. */
export function SosButton() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  async function confirmSos() {
    setSending(true);
    let coords: { lat: number; lng: number } | null = null;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 }),
      );
      coords = { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch {
      // Geolocation denied or unavailable: still send the alert without it.
    }

    const headers = await authHeader();
    await fetch("/api/admin/sos-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ coords }),
    }).catch(() => {});

    setSending(false);
    setOpen(false);
    toast.show("Alert sent to Crew admin.", "success");
    window.location.href = "tel:000";
  }

  return (
    <>
      <button
        type="button"
        aria-label="Emergency SOS"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-crew-red text-white shadow-lg sm:bottom-6"
      >
        <span aria-hidden="true" className="text-xl font-bold">
          SOS
        </span>
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Emergency SOS">
        <p className="mb-4 text-sm text-neutral-600">
          This will call 000 and alert Crew admin with your location if available. Only use this in a genuine
          emergency.
        </p>
        <div className="flex gap-2">
          <Button variant="destructive" disabled={sending} onClick={confirmSos}>
            Call 000 now
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </Dialog>
    </>
  );
}
