# Crew Platform -- Audit Report
**Date:** 2026-07-03
**Phase 0 -- read-only inventory. No fixes applied.**

---

## 1. HTML Inventory

### Monolith app files (inline styles + scripts)

| File | Size | server.js route | vercel.json rewrite |
|---|---|---|---|
| Crew_App_Customer_Role.html | 3,207 KB | /customer | /customer |
| Crew_App_Crew_Member.html | 2,885 KB | /contractor | /contractor |
| index.html | 2,560 KB | static root | n/a |
| Crew_App_Crew_Manager.html | 2,661 KB | /manager | /manager |
| Command_Center_Desktop.html | 989 KB | /command | /command |
| Command_Center_Tablet.html | 987 KB | /command/tablet | /command/tablet |
| CrewBase_Dashboard.html | 760 KB | /dashboard | /dashboard |
| Customer_Portal.html | 58 KB | /portal | /portal |
| CrewBase_Supervisor_App.html | 198 KB | /supervisor | /supervisor |
| CrewBase_Field_Worker_App.html | 77 KB | /field | /field |

### Public marketing and legal pages

| File | Size | server.js route | vercel.json rewrite | Status |
|---|---|---|---|---|
| auth.html | 131 KB | /login /signin | /login /signin | Routed both |
| about.html | 27 KB | none | /about | Vercel only |
| blog.html | 31 KB | none | /blog | Vercel only |
| case-studies.html | 34 KB | none | /case-studies | Vercel only |
| contractors.html | 40 KB | none | /contractors | Vercel only |
| downloads.html | 67 KB | none | /downloads | Vercel only |
| enterprise.html | 40 KB | none | /enterprise | Vercel only |
| escrow.html | 30 KB | none | /escrow | Vercel only |
| get-started.html | 33 KB | none | /get-started | Vercel only |
| gate.html | 11 KB | none | /gate | Vercel only |
| help.html | 33 KB | none | /help | Vercel only |
| privacy.html | 44 KB | none | /privacy | Vercel only |
| terms.html | 28 KB | none | /terms | Vercel only |
| trust.html | 46 KB | none | /trust | Vercel only |
| rewards.html | 69 KB | /rewards | /rewards | Routed both |
| rewards-tc.html | 69 KB | /rewards/tc | /rewards/tc | Routed both |
| report.html | 18 KB | /report | /report | Routed both |
| report-lead-gen-email.html | 11 KB | none | none | No route at all |

Note: the 14 pages listed as "Vercel only" will return 404 in local dev
(npm start) because server.js has no matching rewrites for them.

### Utility pages

| File | Size | Purpose |
|---|---|---|
| 404.html | 4 KB | server.js catch-all error page |
| offline.html | 5 KB | sw.js offline fallback |

### Internal / admin pages

| File | Size | Notes |
|---|---|---|
| CrewBase_App_Controls.html | 28 KB | Demo/control panel |
| CrewBase_Budget_Assets.html | 38 KB | Budget management |
| CrewBase_OCR_Scan.html | 24 KB | OCR scanning tool |
| CrewBase_Printable_Forms.html | 53 KB | Printable form generator |
| CrewBase_Visitor_Management.html | 36 KB | Visitor management |
| Crew_App_Controls.html | 34 KB | App control panel |
| Crew_App_Enterprise_Team_Leader.html | 54 KB | Enterprise TL app |
| Crew_App_Enterprise_Team_Member.html | 83 KB | Enterprise TM app |
| documentation/SUPABASE_SETUP.html | -- | Dev documentation |

### MISSING pages (required by upcoming phases)

| File | Required by | Status |
|---|---|---|
| apps.html | Phase 4 | MISSING |
| complaints.html | Phase 4 | MISSING |
| reset-password.html | Phase 3 | MISSING |
| auth/callback.html | Phase 3 | MISSING |

---

## 2. Broken Links

No existing HTML files contain href="/apps", href="/complaints", or
href="/reset-password". The missing pages are not yet linked from anywhere.

server.js is missing routes for the following pages (404 in local dev):
about, blog, case-studies, contractors, downloads, enterprise, escrow,
get-started, gate, help, privacy, terms, trust.

report-lead-gen-email.html has no clean URL route in server.js or vercel.json.

---

## 3. Service Worker Shell Array

sw.js VERSION = crew-v3. Pre-cache SHELL entries:

| Path | File exists |
|---|---|
| /auth.html | YES |
| /index.html | YES |
| /manifest.json | YES |
| /404.html | YES |
| /offline.html | YES |
| /crew-framework.js | YES |
| /active-jobs-panel.js | YES |

All SHELL entries resolve. No broken pre-cache URLs.

---

## 4. manifest.json Asset Check

Icons: icon.svg, icon-192.png, icon-512.png, icon-192.webp, icon-512.webp --
all exist in /icons/.

Screenshots referenced in manifest: screenshots/customer_0.jpg,
screenshots/contractor_0.jpg, screenshots/crewbase_0.jpg -- all exist.

Shortcut URLs (/Crew_App_Customer_Role.html, /Crew_App_Crew_Member.html,
/CrewBase_Dashboard.html, /rewards.html) all resolve to existing files.

Note: only one manifest exists shared by all roles. Phase 4 must create
per-role manifests for each PWA subdomain (app., pro., field., supervisor.,
command.).

---

## 5. Orphan Files

One-off patch/build scripts not imported by any HTML or required by server.js:

_patch_auth_guard.js, _patch_nav_footer.js, _patch_rewards.js,
add-new-chat.js, fix-chat.js, fix-new-chat-location.js, fix-rentals-2.js,
embed-screenshots.js, take-screenshots.js, pwa-fix-body.js, pwa-gen-icons.js,
pwa-patch.js, upgrade-handover.js, upgrade-rentals.js, patch-demo-data.js,
patch-email-cert.js, crew-integration-e2e.js, crew-demo-data.js,
messaging-team-item-fix.js, messaging-ui-mobile.js, build-apks.sh.

Phase 1 should delete these or move them to scripts/archive/.

---

## 6. Hardcoded Credentials

### Supabase anon key (intentionally public-facing)

The anon key for project ggocdbsspynihtqlgozv is hardcoded in 15+ HTML files:
auth.html (lines 691/693), crew-framework.js (line 26 as fallback),
CrewBase_App_Controls.html, CrewBase_OCR_Scan.html, CrewBase_Printable_Forms.html,
CrewBase_Dashboard.html, CrewBase_Field_Worker_App.html,
Command_Center_Tablet.html, Command_Center_Desktop.html,
CrewBase_Supervisor_App.html, CrewBase_Visitor_Management.html,
CrewBase_Budget_Assets.html, Customer_Portal.html (twice),
Crew_App_Enterprise_Team_Leader.html, Crew_App_Enterprise_Team_Member.html.

Assessment: Supabase anon keys are intentionally public (security from RLS,
not key secrecy). However, 15+ hardcoded copies is a maintenance problem --
rotating the key requires editing every file. Phase 3 must centralise via a
single CREW_CONFIG injection point in crew-framework.js.

### Supabase service-role key (server-side only -- correct)

SUPABASE_SERVICE_ROLE_KEY used via process.env only in server-side payments/
files: escrow.js, checkout.js, onboarding.js, webhooks.js, routes.js.
Never appears in client-side code. Correct.

However, payments/routes.js calls createClient() with the service-role key
on every single HTTP request (9+ locations). This is wasteful. Phase 6 must
use a module-level singleton.

---

## 7. Zai Touchpoint Map

All items below must be replaced or deleted in Phase 6.

### Server-side files (full replacement)

| File | Action required |
|---|---|
| payments/zai-client.js | DELETE entire file |
| payments/checkout.js | Rewrite for CheckVault |
| payments/onboarding.js | Rewrite for CheckVault |
| payments/escrow.js | Rewrite for CheckVault |
| payments/webhooks.js | Rewrite (x-zai-signature -> CheckVault HMAC) |
| payments/routes.js | Rewrite all endpoints; rename /api/webhooks/zai |
| payments/gst.js | Rename zaiFeeCents -> providerFeeCents |
| server.js | Remove /api/webhooks/zai exclusion line 36; remove assemblypayments.com from CSP |

### Client HTML files with Zai references (CSP meta tags or UI copy)

index.html, auth.html, Command_Center_Desktop.html, Command_Center_Tablet.html,
CrewBase_Dashboard.html, Crew_App_Customer_Role.html, Crew_App_Crew_Member.html,
Crew_App_Crew_Manager.html, CrewBase_Budget_Assets.html,
CrewBase_Visitor_Management.html.

### Config files

.env.example: ZAI_CLIENT_ID, ZAI_CLIENT_SECRET, ZAI_ENV -- delete all three.
vercel.json: assemblypayments.com in CSP header value -- remove in Phase 6.
screenshots/command.json: references zai_user_id.

---

## 8. Auth Touchpoint Map

### Methods to be REMOVED in Phase 3

Magic Link / OTP (signInWithOtp): present in auth.html, crew-framework.js,
documentation/supabase_client.js, and these app files: Command_Center_Desktop.html,
Command_Center_Tablet.html, CrewBase_Dashboard.html, Crew_App_Customer_Role.html,
Crew_App_Crew_Member.html, Crew_App_Crew_Manager.html, CrewBase_Supervisor_App.html,
report.html, help.html.

Biometric / WebAuthn (navigator.credentials.create/get): auth.html only.
auth.html also contains a full biometric registration flow with OTP fallback.

### Methods to KEEP or FIX in Phase 3

Google OAuth (signInWithOAuth provider:google): UI exists in auth.html.
Callback redirect URL needs confirming. Keep.

Apple OAuth: mentioned in privacy.html copy but NO implementation exists
in auth.html. Phase 3 must add it.

Email/password (signInWithPassword, signUp): present in auth.html and
crew-framework.js. Keep.

---

## 9. Security Audit -- payments/routes.js

### Question 1: JWT verification on all endpoints

Each payment/onboarding endpoint in routes.js does call auth.getUser(token)
via the requireAuth helper which uses a service-role Supabase client to validate
the Bearer token. CORRECT.

### Question 2: Refund role check from database

The /api/payments/refund endpoint calls requireAdmin which calls requireAuth
and then checks profiles.role against ('admin','crewbase_admin') using a
service-role client DB query. CORRECT -- not trusting client-supplied role.

### Question 3: Caller-is-party checks

approve-release: queries the booking and checks booking.customer_id === userId.
CORRECT.

job-complete: queries the booking and checks booking.contractor_id === userId.
CORRECT.

dispute: queries the booking and checks the caller is customer_id OR
contractor_id. CORRECT.

### Question 4: Demo mode on server endpoints

Demo mode is a localStorage gate in crew-framework.js. The server endpoints
do not read localStorage, cookies set by demo mode, or any client-supplied role
field. The requireAuth function verifies the Supabase JWT via the service-role
client's auth.getUser, which cannot be spoofed by demo mode. SAFE.

However: the global rate limiter in server.js currently throttles ALL requests
including static asset fetches (see issue 1 below).

### Question 5: Webhook raw body

server.js line 35-38 explicitly skips express.json() for /api/webhooks/zai,
allowing webhooks.js to access req.rawBody for HMAC verification. CORRECT.
(Note: the path must be updated to /api/webhooks/checkvault in Phase 6.)

### Question 6: Escrow state transition atomicity

PROBLEM FOUND. payments/escrow.js performs state transitions as:
(1) read current escrow_state, (2) validate, (3) write new state.
There is NO compare-and-swap or row lock between read and write. Two simultaneous
release calls could both pass the read/validate step and both execute the write,
resulting in a double-release. Phase 2 MUST add CAS:
  UPDATE bookings SET escrow_state = :to
  WHERE id = :id AND escrow_state = :expectedFrom
treating 0 rows updated as a 409 CAS conflict.

### Additional issues found

1. MEDIUM: createClient() with service-role key called on every request
   (9+ locations in routes.js). Use a module-level singleton.

2. LOW: bookingId from URL params not validated as UUID format before being
   passed to .eq('id', ...). No SQL injection risk (parameterised) but
   malformed IDs produce confusing 404s rather than 400s.

3. LOW: /api/payments/status/:bookingId returns provider_escrow_id (Zai item ID)
   in the response. After Phase 6 this should be omitted or renamed.

4. INFO: Error handler propagates err.message verbatim to HTTP responses.
   Third-party SDK messages may leak internal detail. Phase 6 should sanitise.

5. INFO: The global rate limiter throttles static asset requests. A single
   load of a 3MB monolith burns multiple request slots, and shared-NAT users
   may be locked out. Phase 2 must scope rate limiting to /api/* only.

---

## 10. Web Push / VAPID Audit

FINDING: Zero VAPID infrastructure exists.

sw.js contains push and notificationclick event handlers -- correct skeleton.

No applicationServerKey anywhere. No VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY.
No /api/push/subscribe endpoint. No /api/push/dispatch function.
No lib/notify.js. No web-push package in package.json.

Notifications are currently delivered only via Supabase Realtime, which
requires the app to be open. Phase 2 must build the full VAPID stack.

---

## 11. CSP Note

Current CSP (both server.js helmet config and vercel.json) includes
'unsafe-inline' for script-src. This cannot be removed without a complete
rewrite of all inline scripts across the monolith HTML files. It is documented
here as an accepted limitation of the monolith architecture. Phase 2 will add
base-uri 'self' which mitigates the main injection vector that unsafe-inline
enables.

---

## 12. Copy Audit

### Em dashes (U+2014 and U+2013)

2,547 total occurrences across 39 HTML files.

Highest-density files:
- Crew_App_Customer_Role.html: 445
- Crew_App_Crew_Member.html: 353
- Command_Center_Desktop.html: 328
- Command_Center_Tablet.html: 327
- Crew_App_Crew_Manager.html: 288
- CrewBase_Dashboard.html: 224

Phase 1 must replace all em/en dashes in user-visible text with commas,
colons, full stops or parentheses. Exceptions: code blocks, HTML comments,
and U+2500-range box-drawing characters in ledger text output.

### AI-tell words (seamless, leverage, empower, elevate, etc.)

457 occurrences across 19 HTML files.

Highest-density files:
- Command_Center_Desktop.html: 130
- Command_Center_Tablet.html: 130
- CrewBase_Dashboard.html: 113
- Crew_App_Crew_Member.html: 35
- Crew_App_Customer_Role.html: 21

Phase 1 must audit and rewrite these as plain Australian business copy.

### US spellings

19,847 raw occurrences across 39 files. The vast majority are CSS property
names (color:, background-color:, text-align: center) which are spec-mandated
identifiers and must NOT be changed. Phase 1 must correct only human-readable
prose copy, for example: analyze -> analyse, organize -> organise, behavior ->
behaviour, canceled -> cancelled, license (when used as a noun) -> licence,
zip code -> postcode, cell phone -> mobile.

---

## 13. Missing Infrastructure Files

| Path | Phase |
|---|---|
| lib/require-user.js | 2 |
| lib/notify.js | 2 |
| lib/invoices.js | 6 |
| api/push/subscribe.js | 2 |
| api/push/dispatch.js | 2 |
| api/ai.js | 8 |
| api/cron/daily.js | 8 |
| api/webhooks/checkvault.js | 8 |
| auth/callback.html | 3 |
| reset-password.html | 3 |
| apps.html | 4 |
| complaints.html | 4 |
| supabase/migrations/0001_init.sql | 5 |
| supabase/migrations/0002_seed_dev.sql | 5 |
| supabase/verify.sql | 5 |
| payments/provider.js | 6 |
| payments/checkvault-client.js | 6 |
| payments/checkvault-mock.js | 6 |
| payments/index.js | 6 |
| payments/http-util.js | 6 |
| payments/__tests__/escrow-lifecycle.test.js | 6 |
| scripts/check-links.mjs | 9 |
| scripts/check-copy.mjs | 9 |
| scripts/run-cron.js | 8 |
| AUTH_SETUP.md | 3 |
| DEPLOY.md | 8 |
| RELEASE_NOTES.md | 9 |

---

## 14. vercel.json Issues

1. Duplicate .webp header block: two source rules both match /(.*)\\.webp.
   The second adds Content-Type: image/webp which the first lacks. Merge them.

2. Duplicate Strict-Transport-Security: the catch-all /(.*) block sets HSTS
   twice (lines 305 and 321).

3. No CSP on API routes: the CSP header only covers /(.*)\\.html. Vercel
   serverless function responses will not include a Content-Security-Policy.

4. X-XSS-Protection: 1; mode=block is deprecated. Modern browsers ignore it.
   Remove in Phase 8.

5. Missing rewrites for apps (/apps -> apps.html), complaints
   (/complaints -> complaints.html), reset-password, and auth/callback.
   Add when those pages are created in Phases 3 and 4.

6. Zai/Assembly CSP domains still present in the CSP header value
   (js.assemblypayments.com, assembly-prelive.s3.amazonaws.com,
   api.assemblypayments.com). Remove in Phase 6, add checkvault.com.au.

---

## 15. TWA / Android Build Status

All 5 TWA manifests exist in twa/. .well-known/assetlinks.json exists.
twa/keystore/.gitkeep is present; actual keystore is in GitHub Secrets
(CREW_KEYSTORE_BASE64). GitHub Actions workflow .github/workflows/build-apks.yml
covers all 5 apps.

| App | Package | Host |
|---|---|---|
| customer | au.com.getcrew.app.customer | app.getcrew.com.au |
| contractor | au.com.getcrew.app.contractor | pro.getcrew.com.au |
| field | au.com.getcrew.app.fieldworker | field.getcrew.com.au |
| supervisor | au.com.getcrew.app.supervisor | supervisor.getcrew.com.au |
| command-tablet | au.com.getcrew.app.commandtablet | command.getcrew.com.au |

---

## 16. Phase-by-Phase Action Summary

| Phase | Key actions from this audit |
|---|---|
| 1 | Delete 21 orphan JS files; add missing server.js routes; replace em/en dashes; rewrite AI-tell copy; fix US spellings in prose (not CSS identifiers) |
| 2 | Create lib/require-user.js, lib/notify.js; add CAS to escrow transitions; build VAPID stack (web-push pkg, subscribe + dispatch); scope rate limiter to /api/*; fix SW update banner; add base-uri 'self' to CSP |
| 3 | Rewrite auth.html (drop Magic Link + OTP + biometric; add Apple OAuth; fix Google OAuth); create reset-password.html + auth/callback.html; centralise anon key |
| 4 | Create apps.html, complaints.html; per-role manifests; update vercel.json rewrites |
| 5 | Create all Supabase migrations and verify.sql |
| 6 | Delete payments/zai-client.js; rewrite all payments/ files for CheckVault; rename zaiFeeCents -> providerFeeCents; fix Supabase client singleton; remove Zai from CSP; sanitise error responses |
| 7 | Product feature additions (quotes, recurring, photos, credentials, availability, metrics) |
| 8 | Fix vercel.json duplicate headers + deprecated X-XSS-Protection; add api/ serverless functions and cron; add missing rewrites |
| 9 | Run check-links.mjs + check-copy.mjs; confirm all security re-check questions pass; write RELEASE_NOTES.md |
