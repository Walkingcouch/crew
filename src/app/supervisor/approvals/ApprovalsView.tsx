"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { EscrowStateBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Database } from "@/lib/supabase/database.types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];

/** Read-only oversight of disputed jobs in the supervisor's organisation.
 * Resolving a dispute is an admin-only action (payments/escrow.js's
 * resolveDispute requires the admin/crewbase_admin role), a supervisor's
 * role here is visibility and early escalation, not resolution. */
export function ApprovalsView() {
  const [disputes, setDisputes] = useState<Booking[] | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: supervisor } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
    if (!supervisor?.org_id) {
      setDisputes([]);
      return;
    }
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("org_id", supervisor.org_id)
      .eq("escrow_state", "DISPUTED")
      .order("disputed_at", { ascending: false });
    setDisputes(data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (disputes === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Disputes needing attention</h1>
      {disputes.length === 0 ? (
        <EmptyState icon="✅" title="No open disputes" description="Disputes in your organisation appear here for visibility." />
      ) : (
        <div className="flex flex-col gap-3">
          {disputes.map((booking) => (
            <Card key={booking.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-crew-ink capitalize">{booking.service_name || booking.service_type}</p>
                  <p className="text-xs text-neutral-500">{booking.dispute_reason}</p>
                </div>
                <EscrowStateBadge state={booking.escrow_state} />
              </div>
              {booking.dispute_notes && <p className="mt-2 text-sm text-neutral-600">{booking.dispute_notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
