import { NextResponse } from "next/server";

/**
 * Non-secret flags the client needs before it can render certain UI: the
 * Apple sign-in button, the card payment option, the beta-access notice,
 * and the VAPID public key needed for pushManager.subscribe(). One-for-one
 * port of the legacy GET /api/config.
 */
export async function GET() {
  return NextResponse.json({
    authAppleEnabled: process.env.AUTH_APPLE_ENABLED === "true",
    paymentsCardEnabled: process.env.PAYMENTS_CARD_ENABLED === "true",
    betaMode: process.env.BETA_MODE === "true",
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
  });
}
