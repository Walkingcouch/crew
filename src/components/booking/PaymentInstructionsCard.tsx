"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { EscrowState } from "@/lib/supabase/database.types";

export interface PaymentInstructions {
  bsb?: string;
  accountNumber?: string;
  billerCode?: string;
  crn?: string;
  reference: string;
  cardCheckoutUrl?: string;
}

/**
 * Shows the CheckVault bank transfer/BPAY details, with copy-to-clipboard
 * and the mandatory "quote your reference" warning, plus a status card
 * that flips live from "Awaiting funds clearance" to "Funds secured in
 * trust" the moment the booking's escrow_state changes, via Realtime,
 * no page refresh needed.
 */
export function PaymentInstructionsCard({
  bookingId,
  instructions,
  initialState,
}: {
  bookingId: string;
  instructions: PaymentInstructions;
  initialState: EscrowState;
}) {
  const toast = useToast();
  const [state, setState] = useState<EscrowState>(initialState);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`booking-pay-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        (payload) => {
          const newState = (payload.new as { escrow_state: EscrowState }).escrow_state;
          setState(newState);
          if (newState === "PAYMENT_HELD") toast.show("Funds secured in trust", "success");
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, toast]);

  function copyReference() {
    navigator.clipboard.writeText(instructions.reference).then(() => toast.show("Reference copied", "success"));
  }

  return (
    <Card>
      <p className="mb-3 text-sm font-semibold text-crew-ink">Pay by bank transfer or BPAY</p>
      <div className="rounded-lg bg-crew-green/5 p-4 text-sm">
        {instructions.bsb && (
          <div className="flex justify-between py-1">
            <span className="text-neutral-500">BSB</span>
            <span className="font-mono font-semibold text-crew-green">{instructions.bsb}</span>
          </div>
        )}
        {instructions.accountNumber && (
          <div className="flex justify-between py-1">
            <span className="text-neutral-500">Account</span>
            <span className="font-mono font-semibold text-crew-green">{instructions.accountNumber}</span>
          </div>
        )}
        {instructions.billerCode && (
          <div className="flex justify-between py-1">
            <span className="text-neutral-500">BPAY biller code</span>
            <span className="font-mono font-semibold text-crew-green">{instructions.billerCode}</span>
          </div>
        )}
        {instructions.crn && (
          <div className="flex justify-between py-1">
            <span className="text-neutral-500">BPAY CRN</span>
            <span className="font-mono font-semibold text-crew-green">{instructions.crn}</span>
          </div>
        )}
        <div className="flex justify-between py-1">
          <span className="text-neutral-500">Reference</span>
          <span className="font-mono text-xs">{instructions.reference}</span>
        </div>
        <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={copyReference}>
          Copy reference
        </Button>
      </div>

      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-800">
        Quote reference {instructions.reference} with your payment, or it cannot be matched to your booking.
      </p>

      <div
        role="status"
        className={`mt-3 rounded-lg p-3 text-sm font-semibold ${
          state === "PAYMENT_HELD" ? "bg-crew-green/10 text-crew-green" : "bg-neutral-100 text-neutral-600"
        }`}
      >
        {state === "PAYMENT_HELD" ? "Funds secured in trust." : "Awaiting funds clearance. Bank transfers take 1 to 2 business days."}
      </div>

      <p className="mt-2 text-xs text-neutral-400">Escrow by CheckVault. AFSL 429 768.</p>
    </Card>
  );
}
