# Crew Auth Setup

Crew signs people in with Google, Apple (optional, behind a flag) or email and password. There is no magic link, no email OTP and no biometric or passkey login anywhere in the platform. This document covers the one-off setup needed in Google Cloud Console, Apple Developer and Supabase before these work in production.

## 1. Google sign-in

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create (or select) a project for Crew.
2. Navigate to **APIs & Services -> OAuth consent screen**. Set the app name to "Crew", add the support email, and add the scopes `email` and `profile`. Publish the consent screen (or keep it in testing with your team's emails added while developing).
3. Navigate to **APIs & Services -> Credentials -> Create Credentials -> OAuth client ID**. Choose **Web application**.
4. Add this Authorised redirect URI (this is Supabase's own callback, not `getcrew.com.au`):
   ```
   https://ggocdbsspynihtqlgozv.supabase.co/auth/v1/callback
   ```
5. Copy the generated **Client ID** and **Client Secret**.
6. In the Supabase dashboard: **Authentication -> Providers -> Google**. Enable it, paste the Client ID and Client Secret, save.

## 2. Apple sign-in (optional, behind `AUTH_APPLE_ENABLED`)

Apple requires a paid Apple Developer Program membership. This may lag the rest of the launch, which is why the button is hidden entirely until `AUTH_APPLE_ENABLED=true` is set (see `.env` and `/api/config`).

1. In the [Apple Developer portal](https://developer.apple.com/account/), under **Certificates, Identifiers & Profiles**:
   - Create an **App ID** (identifier, e.g. `au.com.getcrew.app`) with the "Sign in with Apple" capability enabled.
   - Create a **Services ID** (e.g. `au.com.getcrew.web`) with "Sign in with Apple" enabled and configured. Add this domain and return URL:
     - Domain: `ggocdbsspynihtqlgozv.supabase.co`
     - Return URL: `https://ggocdbsspynihtqlgozv.supabase.co/auth/v1/callback`
   - Create a **Sign in with Apple key** (a `.p8` private key) under **Keys**, associated with the App ID. Download it once, it cannot be downloaded again.
2. In the Supabase dashboard: **Authentication -> Providers -> Apple**. Enable it and supply:
   - Services ID (as the "Client ID")
   - Team ID (top-right of the Apple Developer portal)
   - Key ID (from the key you created)
   - The contents of the `.p8` private key file
3. Set `AUTH_APPLE_ENABLED=true` in the Vercel/production environment once this is done. Leave it `false` (or unset) until then, this is what hides the Apple button on `auth.html`.

## 3. Email + password

No external setup is required beyond Supabase itself, but confirm these settings:

1. **Authentication -> Providers -> Email**: enabled, with **Confirm email** turned on. Sign-up will not return a session until the user clicks the confirmation link, `auth.html` handles this by showing the "check your email" screen instead of routing straight into the app.
2. **Authentication -> URL Configuration**: set the **Site URL** to the production domain (`https://getcrew.com.au`) and add every environment's `/auth/callback` to the **Redirect URLs** allow list, for example:
   ```
   https://getcrew.com.au/auth/callback
   https://app.getcrew.com.au/auth/callback
   https://pro.getcrew.com.au/auth/callback
   http://localhost:3000/auth/callback
   ```
3. Password minimum length is enforced client-side at 10 characters (`auth.html`, `reset-password.html`). If Supabase's own minimum-password-length setting is lower, that's fine, the stricter client-side check still applies; if it's ever set higher than 10, raise the client-side constant to match.

## 4. Password reset flow

`auth.html`'s "Forgot password?" link calls `resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })`. Supabase emails a link that lands on `reset-password.html`, which listens for the `PASSWORD_RECOVERY` auth event and then calls `updateUser({ password })` from that recovery session. No separate token handling is needed, Supabase's client SDK manages the recovery session automatically via `detectSessionInUrl: true`.

## 5. The beta gate

While `BETA_MODE` is on, every sign-in (regardless of method) is checked against the `beta_allowlist` table via the `is_beta_allowed(email)` security-definer RPC (see `supabase/migrations`), not a direct table query, so the allowlist itself is never exposed to anonymous reads. Not-allowed users are signed out immediately and shown a polite "Crew is in private beta" screen with a `mailto:hello@getcrew.com.au` link. This applies identically after Google, Apple and email/password sign-in.

## 6. Preserving `?next=` through an OAuth redirect

Before calling `signInWithOAuth`, `auth.html` stashes any `?next=` query parameter into `sessionStorage` under the key `crew-auth-next` (query parameters don't survive the round trip through Google/Apple and back through Supabase's own callback). `auth/callback.html` reads it back after a successful sign-in and honours it, falling back to the role-appropriate app if there's no `next` value.

## 7. What changed from the old flow

The previous version of this platform used Supabase's magic link / email OTP sign-in, plus an experimental WebAuthn "biometric" registration and sign-in flow. Both have been removed completely, not just hidden:

- No `signInWithOtp`, `verifyOtp` or 6-digit email code screen anywhere.
- No `navigator.credentials.create()` / `navigator.credentials.get()`, no passkey or Face ID / Touch ID code anywhere. `Permissions-Policy` explicitly denies `publickey-credentials-get` and `publickey-credentials-create`.
- TOTP-based two-factor authentication (an authenticator app, e.g. Google Authenticator) is unrelated to the above and is unaffected, it is still required for `crew_member`/`crew_manager` roles via Supabase's own `auth.mfa.*` API.

## 8. Demo mode

The `crew_auth` localStorage gate used for sales presentations is UI-only and lives entirely client-side. It is not touched by any of the above and the server never accepts it as a substitute for a verified session, see the security notes in `AUDIT.md`.
