import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EscrowStateBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function BookingsListPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: bookings } = user
    ? await supabase
        .from("bookings")
        .select("id, ref, service_name, service_type, scheduled_at, total_cents, escrow_state")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-crew-ink">Your bookings</h1>
      {!bookings || bookings.length === 0 ? (
        <EmptyState icon="📋" title="No bookings yet" description="Book your first service to see it here." />
      ) : (
        <div className="flex flex-col gap-3">
          {bookings.map((booking) => (
            <Link key={booking.id} href={`/customer/bookings/${booking.id}`}>
              <Card className="hover:border-crew-green">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-crew-ink capitalize">
                      {booking.service_name || booking.service_type}
                    </p>
                    <p className="text-xs text-neutral-500">{booking.ref}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-crew-ink">${(booking.total_cents / 100).toFixed(2)}</p>
                    <EscrowStateBadge state={booking.escrow_state} />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
