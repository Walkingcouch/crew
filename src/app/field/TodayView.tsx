"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EscrowStateBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { authHeader } from "@/lib/api-client";
import type { Database } from "@/lib/supabase/database.types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];

export function TodayView() {
  const router = useRouter();
  const toast = useToast();
  const [jobs, setJobs] = useState<Booking[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("contractor_id", user.id)
      .gte("scheduled_at", startOfDay.toISOString())
      .lte("scheduled_at", endOfDay.toISOString())
      .order("scheduled_at", { ascending: true });
    setJobs(data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markComplete(bookingId: string) {
    setBusyId(bookingId);
    const headers = await authHeader();
    const res = await fetch("/api/payments/job-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ bookingId }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) return toast.show(data.error || "Could not update job", "error");
    toast.show("Job marked complete", "success");
    load();
  }

  if (jobs === null) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Today&apos;s jobs</h1>
      {jobs.length === 0 ? (
        <EmptyState icon="📋" title="No jobs scheduled today" />
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <Card key={job.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-crew-ink capitalize">{job.service_name || job.service_type}</p>
                  <p className="text-sm text-neutral-500">{job.address}, {job.suburb}</p>
                  <p className="text-xs text-neutral-400">
                    {job.scheduled_at && new Date(job.scheduled_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <EscrowStateBadge state={job.escrow_state} />
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => router.push(`/field/jobs/${job.id}`)}>
                  View job
                </Button>
                {job.escrow_state === "PAYMENT_HELD" && (
                  <Button size="sm" disabled={busyId === job.id} onClick={() => markComplete(job.id)}>
                    Mark complete
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
