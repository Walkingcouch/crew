// eslint-disable-next-line @typescript-eslint/no-require-imports
const { processEvent } = require("../../../../server/payments/webhooks.js");

/**
 * CheckVault webhook receiver. Needs the raw request body for HMAC
 * signature verification, so this bypasses the generic Express-router
 * adapter (which JSON-parses eagerly) and reads the raw bytes directly,
 * exactly like the legacy express.raw() middleware did.
 */
export async function POST(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer());

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  try {
    const result = await processEvent(rawBody, headers, parsedBody);
    // Always 2xx on receipt (including skipped duplicates) so the
    // provider doesn't retry a message we've already processed.
    return Response.json({ received: true, ...result }, { status: 200 });
  } catch (err) {
    const error = err as { statusCode?: number; message?: string };
    return Response.json({ error: error.message || "Webhook processing failed" }, { status: error.statusCode || 500 });
  }
}
