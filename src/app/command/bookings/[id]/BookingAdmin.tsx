"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EscrowStateBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { authHeader } from "@/lib/api-client";
import type { Database } from "@/lib/supabase/database.types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type EscrowEvent = Database["public"]["Tables"]["escrow_events"]["Row"];
type Photo = Database["public"]["Tables"]["job_photos"]["Row"];

export function BookingAdmin({ bookingId }: { bookingId: string }) {
  const toast = useToast();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [events, setEvents] = useState<EscrowEvent[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
    setBooking(data);
    const { data: eventRows } = await supabase.from("escrow_events").select("*").eq("booking_id", bookingId).order("ts", { ascending: true });
    setEvents(eventRows || []);
    const { data: photoRows } = await supabase.from("job_photos").select("*").eq("booking_id", bookingId);
    setPhotos(photoRows || []);
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  async function refund() {
    const cents = Math.round(parseFloat(refundAmount) * 100);
    if (!cents || cents <= 0) return toast.show("Enter a valid amount", "error");
    setBusy(true);
    const headers = { "Content-Type": "application/json", ...(await authHeader()) };
    const res = await fetch("/api/payments/refund", {
      method: "POST",
      headers,
      body: JSON.stringify({ bookingId, refundCents: cents, reason: refundReason || "Admin refund" }),
    });
    const data = await res.json();
    setBusy(false);
    setRefundDialogOpen(false);
    if (!res.ok) return toast.show(data.error || "Refund failed", "error");
    toast.show("Refund processed", "success");
    load();
  }

  async function resolveDispute(resolution: "release" | "refund") {
    setBusy(true);
    const headers = { "Content-Type": "application/json", ...(await authHeader()) };
    const res = await fetch("/api/payments/resolve-dispute", {
      method: "POST",
      headers,
      body: JSON.stringify({ bookingId, resolution, adminNotes }),
    });
    const data = await res.json();
    setBusy(false);
    setDisputeDialogOpen(false);
    if (!res.ok) return toast.show(data.error || "Could not resolve dispute", "error");
    toast.show(`Dispute resolved: ${resolution === "release" ? "released" : "refunded"}`, "success");
    load();
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-crew-ink capitalize">{booking.service_name || booking.service_type}</h1>
          <p className="text-sm text-neutral-500">{booking.ref}</p>
        </div>
        <EscrowStateBadge state={booking.escrow_state} />
      </div>

      <Card className="mb-4">
        <p className="mb-2 text-sm font-semibold text-crew-ink">Escrow timeline</p>
        <div className="flex flex-col gap-1.5">
          {events.map((event) => (
            <div key={event.id} className="flex justify-between text-xs">
              <span className="text-neutral-500">{event.from_state || "-"} &rarr; {event.to_state}</span>
              <span className="text-neutral-400">{new Date(event.ts).toLocaleString("en-AU")}</span>
            </div>
          ))}
        </div>
      </Card>

      {photos.length > 0 && (
        <Card className="mb-4">
          <p className="mb-2 text-sm font-semibold text-crew-ink">Job evidence photos</p>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((photo) => (
              <div key={photo.id} className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
                <Image src={photo.storage_path} alt={photo.kind} fill className="object-cover" unoptimized />
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {booking.escrow_state === "DISPUTED" && (
          <Button variant="destructive" onClick={() => setDisputeDialogOpen(true)}>
            Resolve dispute
          </Button>
        )}
        {["PAYMENT_HELD", "DISPUTABLE", "DISPUTED"].includes(booking.escrow_state) && (
          <Button variant="secondary" onClick={() => setRefundDialogOpen(true)}>
            Manual refund
          </Button>
        )}
      </div>

      <Dialog open={refundDialogOpen} onClose={() => setRefundDialogOpen(false)} title="Refund customer">
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-crew-ink">
            Amount (AUD)
            <input
              type="number"
              step="0.01"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-crew-ink">
            Reason
            <input
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <Button variant="destructive" disabled={busy} onClick={refund}>
            Confirm refund
          </Button>
        </div>
      </Dialog>

      <Dialog open={disputeDialogOpen} onClose={() => setDisputeDialogOpen(false)} title="Resolve dispute">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-600">
            Reason: {booking.dispute_reason}
            {booking.dispute_notes && ` (${booking.dispute_notes})`}
          </p>
          <label className="text-sm font-medium text-crew-ink">
            Admin notes
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => resolveDispute("release")}>
              Release to contractor
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => resolveDispute("refund")}>
              Refund customer
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
