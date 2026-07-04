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
 * Creates the caller's organisation and links their profile to it, or
 * returns the existing one. `organisations` has no client INSERT/UPDATE
 * policy (only SELECT), so this is a service-role write with its own
 * check that the caller doesn't already belong to one, same reasoning as
 * /api/manager/assign-job.
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const { name } = body as { name?: string };
  if (!name) return Response.json({ error: "name is required" }, { status: 400 });

  const supabase = getServiceRoleClient();

  const { data: profile } = await supabase.from("profiles").select("role, org_id").eq("id", auth.user.id).single();
  if (profile?.org_id) {
    return Response.json({ orgId: profile.org_id });
  }
  if (profile?.role !== "crew_manager" && profile?.role !== "admin") {
    return Response.json({ error: "Only a manager can create an organisation" }, { status: 403 });
  }

  const { data: org, error: orgError } = await supabase.from("organisations").insert({ name }).select("id").single();
  if (orgError || !org) return Response.json({ error: orgError?.message || "Could not create organisation" }, { status: 500 });

  await supabase.from("profiles").update({ org_id: org.id }).eq("id", auth.user.id);

  return Response.json({ orgId: org.id });
}
