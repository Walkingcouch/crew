"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { EscrowStateBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Database } from "@/lib/supabase/database.types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  contractorName: string | null;
};

/**
 * Multi-crew job overview. Renders each active job's location as a list
 * (with a link out to Google Maps) rather than an embedded interactive
 * map: adding a mapping library (Leaflet or similar) for one supervisor
 * screen was judged not worth the new dependency weight, list plus
 * external map links gives the same "where is everyone" answer without it.
 */
export function JobMapView() {
  const [jobs, setJobs] = useState<Booking[] | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: supervisor } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
    if (!supervisor?.org_id) {
      setJobs([]);
      return;
    }

    const { data: bookingRows } = await supabase
      .from("bookings")
      .select("*")
      .eq("org_id", supervisor.org_id)
      .in("escrow_state", ["PAYMENT_HELD", "DISPUTABLE"])
      .order("scheduled_at", { ascending: true });

    const contractorIds = [...new Set((bookingRows || []).map((b) => b.contractor_id).filter((id): id is string => !!id))];
    const { data: contractors } =
      contractorIds.length > 0
        ? await supabase.from("profiles").select("id, full_name").in("id", contractorIds)
        : { data: [] };
    const nameById = new Map((contractors || []).map((c) => [c.id, c.full_name]));

    setJobs((bookingRows || []).map((b) => ({ ...b, contractorName: b.contractor_id ? nameById.get(b.contractor_id) ?? null : null })));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (jobs === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Active jobs</h1>
      {jobs.length === 0 ? (
        <EmptyState icon="🗺️" title="No active jobs right now" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {jobs.map((job) => (
            <Card key={job.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-crew-ink capitalize">{job.service_name || job.service_type}</p>
                  <p className="text-sm text-neutral-500">{job.contractorName || "Unassigned"}</p>
                  <p className="text-xs text-neutral-400">{job.address}, {job.suburb}</p>
                </div>
                <EscrowStateBadge state={job.escrow_state} />
              </div>
              {job.lat != null && job.lng != null && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${job.lat},${job.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-crew-green hover:underline"
                >
                  View on map
                </a>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
