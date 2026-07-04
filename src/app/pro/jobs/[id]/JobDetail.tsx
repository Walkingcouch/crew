"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EscrowStateBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { JobPhotoCapture } from "@/components/shared/JobPhotoCapture";
import { authHeader } from "@/lib/api-client";
import type { Database } from "@/lib/supabase/database.types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Photo = Database["public"]["Tables"]["job_photos"]["Row"];

export function JobDetail({ bookingId }: { bookingId: string }) {
  const toast = useToast();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
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
  }, [load]);

  async function markComplete() {
    const afterPhotos = photos.filter((p) => p.kind === "after");
    if (afterPhotos.length === 0) {
      toast.show("Add at least one after-photo before marking the job complete.", "error");
      return;
    }
    setBusy(true);
    const headers = await authHeader();
    const res = await fetch("/api/payments/job-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ bookingId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return toast.show(data.error || "Could not mark job complete", "error");
    toast.show("Job marked complete", "success");
    load();
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const beforePhotos = photos.filter((p) => p.kind === "before");
  const afterPhotos = photos.filter((p) => p.kind === "after");

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-crew-ink capitalize">{booking.service_name || booking.service_type}</h1>
          <p className="text-sm text-neutral-500">{booking.ref}</p>
        </div>
        <EscrowStateBadge state={booking.escrow_state} />
      </div>

      <Card className="mb-4">
        <div className="flex justify-between py-1 text-sm">
          <span className="text-neutral-500">Address</span>
          <span className="text-crew-ink">{booking.address}, {booking.suburb}</span>
        </div>
        <div className="flex justify-between py-1 text-sm">
          <span className="text-neutral-500">Scheduled</span>
          <span className="text-crew-ink">{booking.scheduled_at && new Date(booking.scheduled_at).toLocaleString("en-AU")}</span>
        </div>
        <div className="flex justify-between py-1 text-sm">
          <span className="text-neutral-500">Payout</span>
          <span className="font-semibold text-crew-ink">${(booking.total_cents * 0.9 / 100).toFixed(2)}</span>
        </div>
        {booking.description && <p className="mt-2 text-sm text-neutral-600">{booking.description}</p>}
      </Card>

      <Card className="mb-4">
        <p className="mb-2 text-sm font-semibold text-crew-ink">Before photos</p>
        <PhotoGrid photos={beforePhotos} />
        <div className="mt-2">
          <JobPhotoCapture bookingId={bookingId} kind="before" onUploaded={load} />
        </div>
      </Card>

      {booking.escrow_state === "PAYMENT_HELD" && (
        <Card className="mb-4">
          <p className="mb-2 text-sm font-semibold text-crew-ink">After photos</p>
          <PhotoGrid photos={afterPhotos} />
          <div className="mt-2 flex gap-2">
            <JobPhotoCapture bookingId={bookingId} kind="after" onUploaded={load} />
            <Button size="sm" disabled={busy} onClick={markComplete}>
              Mark job complete
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function PhotoGrid({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) return <p className="text-xs text-neutral-400">No photos yet.</p>;
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo) => (
        <div key={photo.id} className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
          <Image src={photo.storage_path} alt={photo.kind} fill className="object-cover" unoptimized />
        </div>
      ))}
    </div>
  );
}
