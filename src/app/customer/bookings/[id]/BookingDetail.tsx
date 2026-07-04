"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EscrowStateBadge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PaymentInstructionsCard, type PaymentInstructions } from "@/components/booking/PaymentInstructionsCard";
import type { Database, EscrowState } from "@/lib/supabase/database.types";
import { authHeader } from "@/lib/api-client";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Photo = Database["public"]["Tables"]["job_photos"]["Row"];

export function BookingDetail({ bookingId }: { bookingId: string }) {
  const toast = useToast();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [instructions, setInstructions] = useState<PaymentInstructions | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [cancelPreview, setCancelPreview] = useState<{ feeCents: number; refundCents: number } | null>(null);
  const [disputeReason, setDisputeReason] = useState("INCOMPLETE_WORK");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
    setBooking(data);

    const { data: photoRows } = await supabase.from("job_photos").select("*").eq("booking_id", bookingId);
    setPhotos(photoRows || []);
  }, [bookingId]);

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel(`booking-detail-${bookingId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, load]);

  useEffect(() => {
    if (!booking || booking.escrow_state !== "PAYMENT_PENDING") return;
    (async () => {
      const headers = await authHeader();
      const res = await fetch("/api/payments/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();
      if (res.ok) setInstructions(data.paymentInstructions);
    })();
  }, [booking, bookingId]);

  async function approveRelease() {
    setBusy(true);
    const headers = await authHeader();
    const res = await fetch("/api/payments/approve-release", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ bookingId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return toast.show(data.error || "Could not release payment", "error");
    toast.show("Payment released", "success");
    load();
  }

  async function openCancelDialog() {
    if (!booking) return;
    const hoursUntil = (new Date(booking.scheduled_at || 0).getTime() - Date.now()) / 3_600_000;
    const isLate = hoursUntil <= 2;
    const feeCents = isLate ? Math.floor(booking.total_cents * 0.25) : 0;
    setCancelPreview({ feeCents, refundCents: booking.total_cents - feeCents });
    setCancelDialogOpen(true);
  }

  async function confirmCancel() {
    setBusy(true);
    const headers = await authHeader();
    const res = await fetch("/api/payments/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ bookingId, reason: "Customer requested" }),
    });
    const data = await res.json();
    setBusy(false);
    setCancelDialogOpen(false);
    if (!res.ok) return toast.show(data.error || "Could not cancel booking", "error");
    toast.show("Booking cancelled", "success");
    load();
  }

  async function submitDispute() {
    setBusy(true);
    const headers = await authHeader();
    const res = await fetch("/api/payments/dispute", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ bookingId, reason: disputeReason }),
    });
    const data = await res.json();
    setBusy(false);
    setDisputeDialogOpen(false);
    if (!res.ok) return toast.show(data.error || "Could not raise dispute", "error");
    toast.show("Dispute raised. Our team will review the evidence.", "success");
    load();
  }

  async function downloadInvoice() {
    const headers = await authHeader();
    const res = await fetch(`/api/payments/invoice/${bookingId}`, { headers });
    const data = await res.json();
    if (!res.ok || !data.url) return toast.show(data.error || "Invoice not available yet", "error");
    window.open(data.url, "_blank");
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const state: EscrowState = booking.escrow_state;
  const canCancel = ["CREATED", "PAYMENT_PENDING", "PAYMENT_HELD", "DISPUTABLE"].includes(state);
  const canDispute = ["PAYMENT_HELD", "DISPUTABLE"].includes(state);

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-crew-ink capitalize">{booking.service_name || booking.service_type}</h1>
          <p className="text-sm text-neutral-500">{booking.ref}</p>
        </div>
        <EscrowStateBadge state={state} />
      </div>

      <Card className="mb-4">
        <div className="flex justify-between py-1 text-sm">
          <span className="text-neutral-500">Address</span>
          <span className="text-crew-ink">{booking.address}, {booking.suburb}</span>
        </div>
        <div className="flex justify-between py-1 text-sm">
          <span className="text-neutral-500">Scheduled</span>
          <span className="text-crew-ink">
            {booking.scheduled_at && new Date(booking.scheduled_at).toLocaleString("en-AU")}
          </span>
        </div>
        <div className="flex justify-between py-1 text-sm">
          <span className="text-neutral-500">Total</span>
          <span className="font-semibold text-crew-ink">${(booking.total_cents / 100).toFixed(2)}</span>
        </div>
      </Card>

      {state === "PAYMENT_PENDING" && instructions && (
        <div className="mb-4">
          <PaymentInstructionsCard bookingId={bookingId} instructions={instructions} initialState={state} />
        </div>
      )}

      {state === "DISPUTABLE" && (
        <Card className="mb-4">
          <p className="mb-3 text-sm text-neutral-600">
            The job has been marked complete. Approve release once you are happy, or raise a dispute if there is a problem.
          </p>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={approveRelease}>
              Approve release
            </Button>
            {canDispute && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => setDisputeDialogOpen(true)}>
                Raise dispute
              </Button>
            )}
          </div>
        </Card>
      )}

      {photos.length > 0 && (
        <Card className="mb-4">
          <p className="mb-2 text-sm font-semibold text-crew-ink">Job photos</p>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <div key={photo.id} className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
                <Image src={photo.storage_path} alt={photo.kind} fill className="object-cover" unoptimized />
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {state === "RELEASED" && (
          <Button size="sm" variant="secondary" onClick={downloadInvoice}>
            Download invoice
          </Button>
        )}
        {canCancel && (
          <Button size="sm" variant="destructive" onClick={openCancelDialog}>
            Cancel booking
          </Button>
        )}
      </div>

      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} title="Cancel this booking?">
        {cancelPreview && (
          <div className="flex flex-col gap-3">
            {cancelPreview.feeCents > 0 ? (
              <p className="text-sm text-neutral-600">
                This is within 2 hours of the scheduled start. A 25% late cancellation fee of{" "}
                <strong>${(cancelPreview.feeCents / 100).toFixed(2)}</strong> applies. You will be refunded{" "}
                <strong>${(cancelPreview.refundCents / 100).toFixed(2)}</strong>.
              </p>
            ) : (
              <p className="text-sm text-neutral-600">You will receive a full refund.</p>
            )}
            <div className="flex gap-2">
              <Button variant="destructive" disabled={busy} onClick={confirmCancel}>
                Confirm cancellation
              </Button>
              <Button variant="ghost" onClick={() => setCancelDialogOpen(false)}>
                Keep booking
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={disputeDialogOpen} onClose={() => setDisputeDialogOpen(false)} title="Raise a dispute">
        <div className="flex flex-col gap-3">
          <select
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="INCOMPLETE_WORK">Incomplete work</option>
            <option value="POOR_QUALITY">Poor quality</option>
            <option value="NO_SHOW">Contractor did not show</option>
            <option value="OTHER">Other</option>
          </select>
          <Button variant="destructive" disabled={busy} onClick={submitDispute}>
            Submit dispute
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
