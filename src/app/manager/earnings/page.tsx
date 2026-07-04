import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function ManagerEarningsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user ? await supabase.from("profiles").select("org_id").eq("id", user.id).single() : { data: null };

  const { data: bookings } = profile?.org_id
    ? await supabase
        .from("bookings")
        .select("id, ref, service_name, service_type, total_cents, contractor_id")
        .eq("org_id", profile.org_id)
        .eq("escrow_state", "RELEASED")
        .order("payment_released_at", { ascending: false })
    : { data: [] };

  const totalPayout = (bookings || []).reduce((sum, b) => sum + Math.round(b.total_cents * 0.94), 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-crew-ink">Organisation earnings</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Total paid out: <span className="font-semibold text-crew-green">${(totalPayout / 100).toFixed(2)}</span> (enterprise 6% commission)
      </p>

      {!bookings || bookings.length === 0 ? (
        <EmptyState icon="💰" title="No completed jobs yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {bookings.map((booking) => (
            <Card key={booking.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-crew-ink capitalize">{booking.service_name || booking.service_type}</p>
                <p className="text-xs text-neutral-400">{booking.ref}</p>
              </div>
              <p className="font-semibold text-crew-green">${((booking.total_cents * 0.94) / 100).toFixed(2)}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
