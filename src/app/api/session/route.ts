import { authenticateRequest } from "@/server/lib/auth-adapter";

/** Clients poll this to detect session expiry and redirect to /login. */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  return Response.json({ id: auth.user.id, email: auth.user.email });
}
