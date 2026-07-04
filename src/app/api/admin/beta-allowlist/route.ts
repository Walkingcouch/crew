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
 * beta_allowlist has RLS enabled with zero policies (service-role only,
 * "mediated entirely by the is_beta_allowed RPC" per the migration's own
 * comment), so admin management of it has to go through a service-role
 * Route Handler, there is no client-side path that would ever work here.
 */
export async function GET(request: Request) {
  const auth = await authenticateAdminRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.from("beta_allowlist").select("*").order("added_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ allowlist: data });
}

export async function POST(request: Request) {
  const auth = await authenticateAdminRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const { email, note } = body as { email?: string; note?: string };
  if (!email) return Response.json({ error: "email is required" }, { status: 400 });

  const supabase = getServiceRoleClient();
  const { error } = await supabase.from("beta_allowlist").insert({ email: email.toLowerCase(), note });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await authenticateAdminRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  if (!email) return Response.json({ error: "email query param is required" }, { status: 400 });

  const supabase = getServiceRoleClient();
  const { error } = await supabase.from("beta_allowlist").delete().eq("email", email.toLowerCase());
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
