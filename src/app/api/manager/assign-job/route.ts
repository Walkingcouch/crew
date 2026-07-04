import { createClient } from "@supabase/supabase-js";
import { authenticateRequest } from "@/server/lib/auth-adapter";
import type { Database } from "@/lib/supabase/database.types";

function getServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    { auth: { persistSession: false } },
  );
}

/**
 * Assigns a crew member to an org-owned booking. `bookings` intentionally
 * has no client UPDATE policy at all (escrow_state and payment columns
 * are service-role only, per the schema's own comment), so contractor
 * assignment, a legitimate manager action, has to go through a
 * service-role write with its own authorisation check here rather than a
 * direct client-side update RLS would otherwise silently drop.
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const { bookingId, contractorId } = body as { bookingId?: string; contractorId?: string };
  if (!bookingId || !contractorId) {
    return Response.json({ error: "bookingId and contractorId are required" }, { status: 400 });
  }

  const supabase = getServiceRoleClient();

  const { data: manager } = await supabase.from("profiles").select("role, org_id").eq("id", auth.user.id).single();
  if (!manager || !["crew_manager", "admin", "crewbase_admin"].includes(manager.role) || !manager.org_id) {
    return Response.json({ error: "Only an org manager can assign jobs" }, { status: 403 });
  }

  const { data: booking } = await supabase.from("bookings").select("org_id, contractor_id").eq("id", bookingId).single();
  if (!booking || booking.org_id !== manager.org_id) {
    return Response.json({ error: "Booking not found in your organisation" }, { status: 404 });
  }
  if (booking.contractor_id) {
    return Response.json({ error: "This job is already assigned" }, { status: 409 });
  }

  const { data: contractor } = await supabase.from("profiles").select("org_id").eq("id", contractorId).single();
  if (!contractor || contractor.org_id !== manager.org_id) {
    return Response.json({ error: "That contractor is not in your organisation" }, { status: 400 });
  }

  const { error } = await supabase.from("bookings").update({ contractor_id: contractorId }).eq("id", bookingId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
