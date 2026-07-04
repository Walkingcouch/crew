"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type PricingMode = "fixed" | "quoted";
type RecurrenceRule = "" | "weekly" | "fortnightly" | "monthly";

const FIXED_PRICE_CENTS = 6500; // Standard job price placeholder until a real pricing engine exists.

export function BookingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialService = searchParams.get("service") || "handyman";
  const toast = useToast();
  const supabase = createClient();

  const [pricingMode, setPricingMode] = useState<PricingMode>("fixed");
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceRule>("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.show("Please sign in to book a service.", "error");
      setSubmitting(false);
      return;
    }

    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({
        customer_id: user.id,
        service_type: initialService,
        service_name: initialService.replace(/-/g, " "),
        description: description || null,
        address,
        suburb,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        total_cents: FIXED_PRICE_CENTS,
        pricing_mode: pricingMode,
        recurrence_rule: recurrence || null,
        recurrence_remaining: recurrence ? 11 : null,
        recurrence_next_at: recurrence && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      })
      .select("id")
      .single();

    setSubmitting(false);

    if (error || !booking) {
      toast.show(error?.message || "Could not create booking", "error");
      return;
    }

    if (pricingMode === "quoted") {
      router.push(`/customer/quotes/${booking.id}`);
    } else {
      router.push(`/customer/bookings/${booking.id}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-bold text-crew-ink capitalize">{initialService.replace(/-/g, " ")}</h1>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setPricingMode("fixed")}
          className={`flex-1 rounded-full py-2 text-sm font-semibold ${pricingMode === "fixed" ? "bg-crew-green text-white" : "bg-neutral-100 text-neutral-600"}`}
        >
          Fixed price
        </button>
        <button
          type="button"
          onClick={() => setPricingMode("quoted")}
          className={`flex-1 rounded-full py-2 text-sm font-semibold ${pricingMode === "quoted" ? "bg-crew-green text-white" : "bg-neutral-100 text-neutral-600"}`}
        >
          Get quotes
        </button>
      </div>

      <Input label="Address" required value={address} onChange={(e) => setAddress(e.target.value)} />
      <Input label="Suburb" required value={suburb} onChange={(e) => setSuburb(e.target.value)} />
      <Input
        label="Preferred date and time"
        type="datetime-local"
        required
        value={scheduledAt}
        onChange={(e) => setScheduledAt(e.target.value)}
      />

      <Select label="Repeat" value={recurrence} onChange={(e) => setRecurrence(e.target.value as RecurrenceRule)}>
        <option value="">Just once</option>
        <option value="weekly">Weekly</option>
        <option value="fortnightly">Fortnightly</option>
        <option value="monthly">Monthly</option>
      </Select>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-crew-ink">
          Job details
        </label>
        <textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm"
        />
      </div>

      {pricingMode === "fixed" && (
        <p className="text-sm text-neutral-500">
          Total: <span className="font-semibold text-crew-ink">${(FIXED_PRICE_CENTS / 100).toFixed(2)}</span> (GST included)
        </p>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Creating booking..." : pricingMode === "quoted" ? "Request quotes" : "Continue to payment"}
      </Button>
    </form>
  );
}
