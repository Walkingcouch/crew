import { authenticateRequest } from "@/server/lib/auth-adapter";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { notifyAdmin } = require("../../../../server/lib/notify.js");

/** Records an SOS alert for admin attention (service-role write, same
 * reason as /api/account/request-deletion: admin_notifications has no
 * client insert policy by design). The caller still dials 000 directly
 * from the browser regardless of whether this call succeeds. */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const coords = (body as { coords?: { lat: number; lng: number } | null }).coords;

  await notifyAdmin({
    type: "sos_alert",
    message: `SOS alert from ${auth.user.email}${coords ? ` at ${coords.lat}, ${coords.lng}` : " (location unavailable)"}`,
    meta: { user_id: auth.user.id, coords },
    email: true,
  });

  return Response.json({ ok: true });
}
