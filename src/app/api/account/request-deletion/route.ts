import { authenticateRequest } from "@/server/lib/auth-adapter";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { notifyAdmin } = require("../../../../server/lib/notify.js");

/**
 * Records an account deletion request for a human to action (there is no
 * self-service delete: removing an auth.users row needs the service-role
 * key, and admin_notifications has no client insert policy by design,
 * only admins may read or write it). Matches the legacy "Delete from
 * Settings -> Account -> Delete, data deleted within 30 days" copy.
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  await notifyAdmin({
    type: "account_deletion_request",
    message: `Account deletion requested by ${auth.user.email}`,
    meta: { user_id: auth.user.id },
    email: true,
  });

  return Response.json({ ok: true });
}
