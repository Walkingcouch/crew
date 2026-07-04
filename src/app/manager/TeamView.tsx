"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { authHeader } from "@/lib/api-client";
import type { Database } from "@/lib/supabase/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Booking = Database["public"]["Tables"]["bookings"]["Row"];

export function TeamView() {
  const toast = useToast();
  const [team, setTeam] = useState<Profile[] | null>(null);
  const [unassignedJobs, setUnassignedJobs] = useState<Booking[] | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: manager } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
    if (!manager?.org_id) {
      setTeam([]);
      setUnassignedJobs([]);
      return;
    }

    const { data: members } = await supabase
      .from("profiles")
      .select("*")
      .eq("org_id", manager.org_id)
      .in("role", ["crew_member", "field_worker"]);
    setTeam(members || []);

    const { data: jobs } = await supabase
      .from("bookings")
      .select("*")
      .eq("org_id", manager.org_id)
      .is("contractor_id", null)
      .order("scheduled_at", { ascending: true });
    setUnassignedJobs(jobs || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function assignJob(bookingId: string, contractorId: string) {
    if (!contractorId) return;
    setAssigning(bookingId);
    const headers = { "Content-Type": "application/json", ...(await authHeader()) };
    const res = await fetch("/api/manager/assign-job", {
      method: "POST",
      headers,
      body: JSON.stringify({ bookingId, contractorId }),
    });
    const data = await res.json();
    setAssigning(null);
    if (!res.ok) return toast.show(data.error || "Could not assign job", "error");
    toast.show("Job assigned", "success");
    load();
  }

  if (team === null || unassignedJobs === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Team overview</h1>

      {team.length === 0 ? (
        <EmptyState icon="👥" title="No team members yet" description="Complete organisation verification to start adding crew members." />
      ) : (
        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          {team.map((member) => (
            <Card key={member.id}>
              <p className="font-semibold text-crew-ink">{member.full_name || member.email}</p>
              <p className="text-xs text-neutral-500 capitalize">{member.role.replace("_", " ")}</p>
              {member.paused && <p className="mt-1 text-xs font-semibold text-crew-red">Paused</p>}
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-lg font-bold text-crew-ink">Unassigned jobs</h2>
      {unassignedJobs.length === 0 ? (
        <EmptyState icon="📋" title="No unassigned jobs" />
      ) : (
        <div className="flex flex-col gap-3">
          {unassignedJobs.map((job) => (
            <Card key={job.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-crew-ink capitalize">{job.service_name || job.service_type}</p>
                <p className="text-xs text-neutral-500">{job.suburb}</p>
              </div>
              <Select
                label="Assign to"
                className="w-40"
                disabled={assigning === job.id}
                onChange={(e) => assignJob(job.id, e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>
                  Assign to...
                </option>
                {team.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name || member.email}
                  </option>
                ))}
              </Select>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
