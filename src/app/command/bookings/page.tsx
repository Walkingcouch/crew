import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EscrowStateBadge } from "@/components/ui/Badge";

export default async function CommandBookingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, ref, service_name, service_type, total_cents, escrow_state, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Bookings &amp; escrow</h1>
      <div className="flex flex-col gap-2">
        {(bookings || []).map((booking) => (
          <Link key={booking.id} href={`/command/bookings/${booking.id}`}>
            <Card className="flex items-center justify-between hover:border-crew-green">
              <div>
                <p className="text-sm font-semibold text-crew-ink capitalize">{booking.service_name || booking.service_type}</p>
                <p className="text-xs text-neutral-400">{booking.ref}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-crew-ink">${(booking.total_cents / 100).toFixed(2)}</p>
                <EscrowStateBadge state={booking.escrow_state} />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
