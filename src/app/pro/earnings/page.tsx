import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function EarningsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: bookings } = user
    ? await supabase
        .from("bookings")
        .select("id, ref, service_name, service_type, total_cents, payment_released_at")
        .eq("contractor_id", user.id)
        .eq("escrow_state", "RELEASED")
        .order("payment_released_at", { ascending: false })
    : { data: [] };

  const totalPayout = (bookings || []).reduce((sum, b) => sum + Math.round(b.total_cents * 0.9), 0);

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-crew-ink">Earnings</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Total paid out: <span className="font-semibold text-crew-green">${(totalPayout / 100).toFixed(2)}</span>
      </p>

      {!bookings || bookings.length === 0 ? (
        <EmptyState icon="💰" title="No completed jobs yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {bookings.map((booking) => {
            const payoutCents = Math.round(booking.total_cents * 0.9);
            return (
              <Card key={booking.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-crew-ink capitalize">{booking.service_name || booking.service_type}</p>
                  <p className="text-xs text-neutral-400">{booking.ref}</p>
                </div>
                <p className="font-semibold text-crew-green">${(payoutCents / 100).toFixed(2)}</p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
