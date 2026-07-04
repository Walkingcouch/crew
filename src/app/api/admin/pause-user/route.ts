import { createClient } from "@supabase/supabase-js";
import { authenticateAdminRequest } from "@/server/lib/auth-adapter";
import type { Database } from "@/lib/supabase/database.types";

function getServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    { auth: { persistSession: false } },
  );
}

/**
 * Admin pause/unpause. profiles.paused/paused_reason are explicitly
 * REVOKEd from client UPDATE in the migration (column-level GRANT/REVOKE,
 * see supabase/migrations/0001_init.sql), so this has to be a
 * service-role write, admin-gated by authenticateAdminRequest.
 */
export async function POST(request: Request) {
  const auth = await authenticateAdminRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const { userId, paused, reason } = body as { userId?: string; paused?: boolean; reason?: string };
  if (!userId || typeof paused !== "boolean") {
    return Response.json({ error: "userId and paused (boolean) are required" }, { status: 400 });
  }

  const supabase = getServiceRoleClient();
  const { error } = await supabase
    .from("profiles")
    .update({ paused, paused_reason: paused ? reason || "Paused by admin" : null })
    .eq("id", userId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
