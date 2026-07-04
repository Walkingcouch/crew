"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { authHeader } from "@/lib/api-client";

interface Quote {
  id: string;
  contractor_id: string;
  amount_cents: number;
  message: string | null;
  status: string;
  profiles?: { full_name: string | null; rating_avg: number | null; rating_count: number } | null;
}

export function QuotesReview({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const headers = await authHeader();
    const res = await fetch(`/api/quotes/${bookingId}`, { headers });
    const data = await res.json();
    setQuotes(data.quotes || []);
  }, [bookingId]);

  useEffect(() => {
    load();

    const supabase = createClient();
    const channel = supabase
      .channel(`quotes-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quotes", filter: `booking_id=eq.${bookingId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, load]);

  async function accept(quoteId: string) {
    setBusyId(quoteId);
    const headers = await authHeader();
    const res = await fetch(`/api/quotes/${quoteId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      toast.show(data.error || "Could not accept quote", "error");
      return;
    }
    toast.show("Quote accepted", "success");
    router.push(`/customer/bookings/${bookingId}`);
  }

  async function decline(quoteId: string) {
    setBusyId(quoteId);
    const headers = await authHeader();
    await fetch(`/api/quotes/${quoteId}/decline`, { method: "POST", headers });
    setBusyId(null);
    load();
  }

  if (quotes === null) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const pending = quotes.filter((q) => q.status === "pending").sort((a, b) => a.amount_cents - b.amount_cents);

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Quotes received</h1>
      {pending.length === 0 ? (
        <EmptyState
          icon="📨"
          title="No quotes yet"
          description="Contractors in your area will submit quotes soon. We will notify you when one arrives."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((quote) => (
            <Card key={quote.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-crew-ink">{quote.profiles?.full_name || "Contractor"}</p>
                  {quote.profiles?.rating_avg && (
                    <p className="text-xs text-neutral-500">
                      ⭐ {quote.profiles.rating_avg.toFixed(1)} ({quote.profiles.rating_count})
                    </p>
                  )}
                </div>
                <p className="text-lg font-bold text-crew-green">${(quote.amount_cents / 100).toFixed(2)}</p>
              </div>
              {quote.message && <p className="mt-2 text-sm text-neutral-600">{quote.message}</p>}
              <div className="mt-3 flex gap-2">
                <Button size="sm" disabled={busyId === quote.id} onClick={() => accept(quote.id)}>
                  Accept
                </Button>
                <Button size="sm" variant="secondary" disabled={busyId === quote.id} onClick={() => decline(quote.id)}>
                  Decline
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
