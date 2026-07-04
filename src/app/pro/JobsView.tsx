"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Tabs } from "@/components/ui/Tabs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { EscrowStateBadge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { authHeader } from "@/lib/api-client";
import type { Database } from "@/lib/supabase/database.types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];

export function JobsView() {
  const router = useRouter();
  const toast = useToast();
  const [openJobs, setOpenJobs] = useState<Booking[] | null>(null);
  const [assignedJobs, setAssignedJobs] = useState<Booking[] | null>(null);
  const [quoteDialogJob, setQuoteDialogJob] = useState<Booking | null>(null);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: open } = await supabase
      .from("bookings")
      .select("*")
      .eq("pricing_mode", "quoted")
      .is("contractor_id", null)
      .order("created_at", { ascending: false });
    setOpenJobs(open || []);

    const { data: assigned } = await supabase
      .from("bookings")
      .select("*")
      .eq("contractor_id", user.id)
      .not("escrow_state", "in", "(RELEASED,REFUNDED,CANCELLED)")
      .order("scheduled_at", { ascending: true });
    setAssignedJobs(assigned || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitQuote() {
    if (!quoteDialogJob) return;
    const amountCents = Math.round(parseFloat(quoteAmount) * 100);
    if (!amountCents || amountCents <= 0) return toast.show("Enter a valid amount", "error");

    setBusyId(quoteDialogJob.id);
    const headers = await authHeader();
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ bookingId: quoteDialogJob.id, amountCents, message: quoteMessage || undefined }),
    });
    const data = await res.json();
    setBusyId(null);
    setQuoteDialogJob(null);
    setQuoteAmount("");
    setQuoteMessage("");
    if (!res.ok) return toast.show(data.error || "Could not submit quote", "error");
    toast.show("Quote submitted", "success");
  }

  async function markJobComplete(bookingId: string) {
    setBusyId(bookingId);
    const headers = await authHeader();
    const res = await fetch("/api/payments/job-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ bookingId }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) return toast.show(data.error || "Could not mark job complete", "error");
    toast.show("Job marked complete. Add after-photos from the job page.", "success");
    load();
  }

  if (openJobs === null || assignedJobs === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Tabs
        items={[
          {
            id: "open",
            label: `Open jobs (${openJobs.length})`,
            content:
              openJobs.length === 0 ? (
                <EmptyState icon="🔍" title="No open jobs right now" description="New Get Quotes jobs in your area will appear here." />
              ) : (
                <div className="flex flex-col gap-3">
                  {openJobs.map((job) => (
                    <Card key={job.id}>
                      <p className="font-semibold text-crew-ink capitalize">{job.service_name || job.service_type}</p>
                      <p className="text-sm text-neutral-500">{job.suburb}</p>
                      <p className="mt-1 text-xs text-neutral-400">
                        {job.scheduled_at && new Date(job.scheduled_at).toLocaleString("en-AU")}
                      </p>
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setQuoteDialogJob(job);
                          setQuoteAmount("");
                          setQuoteMessage("");
                        }}
                      >
                        Submit quote
                      </Button>
                    </Card>
                  ))}
                </div>
              ),
          },
          {
            id: "assigned",
            label: `My jobs (${assignedJobs.length})`,
            content:
              assignedJobs.length === 0 ? (
                <EmptyState icon="🧰" title="No assigned jobs" description="Jobs you have quoted on or been booked for appear here." />
              ) : (
                <div className="flex flex-col gap-3">
                  {assignedJobs.map((job) => (
                    <Card key={job.id}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-crew-ink capitalize">{job.service_name || job.service_type}</p>
                          <p className="text-sm text-neutral-500">{job.address}, {job.suburb}</p>
                        </div>
                        <EscrowStateBadge state={job.escrow_state} />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => router.push(`/pro/jobs/${job.id}`)}>
                          View job
                        </Button>
                        {job.escrow_state === "PAYMENT_HELD" && (
                          <Button size="sm" disabled={busyId === job.id} onClick={() => markJobComplete(job.id)}>
                            Mark complete
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ),
          },
        ]}
      />

      <Dialog open={!!quoteDialogJob} onClose={() => setQuoteDialogJob(null)} title="Submit your quote">
        <div className="flex flex-col gap-3">
          <Input label="Amount (AUD)" type="number" min="1" step="0.01" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="quote-message" className="text-sm font-medium text-crew-ink">
              Message (optional)
            </label>
            <textarea
              id="quote-message"
              rows={3}
              value={quoteMessage}
              onChange={(e) => setQuoteMessage(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm"
            />
          </div>
          <Button disabled={!!busyId} onClick={submitQuote}>
            Submit quote
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
