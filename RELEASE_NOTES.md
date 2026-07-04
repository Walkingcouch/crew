# Crew Platform: Release Notes

This build takes Crew from "v1 with known issues" to deployment-ready, across
10 phases. Full rationale for every non-obvious call is in `DECISIONS.md`;
the inventory and audit trail is in `AUDIT.md`.

## What shipped

**Cleanup and correctness (Phase 0-1)**: full HTML/link/service-worker/orphan
audit, broken-link repairs, an em-dash and AI-tell-word sweep (with the false
positives filtered out, CSS custom properties and Web API spec keys are not
prose), Australian English pass, `lang="en-AU"` on every page, an SOS button,
ARIA fixes, and a from-scratch scan that found and fixed 11+ pre-existing JS
syntax errors sitting silently in inline `<script>` blocks across the
monolith HTML files.

**Security hardening and Web Push (Phase 2)**: fixed a false-positive auth
error handler that was force-logging out users on transient network errors,
added Web Push end-to-end (VAPID, service worker resubscription handling,
per-endpoint subscription storage), timeout guards on the AI proxy, and
closed a real authorisation gap in `payments/routes.js` (a missing import
that meant several endpoints would have thrown at runtime, a dispute
endpoint that only let customers dispute, an onboarding endpoint that
trusted a client-supplied provider account ID).

**Auth overhaul (Phase 3)**: replaced email OTP/magic-link entirely with
Google sign-in, Apple sign-in (behind `AUTH_APPLE_ENABLED`), and
email+password via Supabase Auth, plus a proper PKCE `/auth/callback` page
and password reset flow. TOTP-based 2FA (genuinely not biometric) is
unchanged. No `navigator.credentials`, WebAuthn, or passkey code anywhere,
and `Permissions-Policy` denies `publickey-credentials-get`/`-create`
platform-wide.

**PWAs, branding, legal, SEO (Phase 4)**: recovered the real Crew logo from
a base64-embedded asset, generated a full icon pipeline for the marketing
site and all 6 role apps, gave every role its own installable PWA manifest,
built the `/apps` install page, and added `terms.html`/`privacy.html`/
`complaints.html` (all marked `DRAFT: requires legal review before launch`,
this has **not** been done and must happen before real users see them).

**Database (Phase 5)**: a single consolidated, idempotent migration
(`supabase/migrations/0001_init.sql`) covering every table, RLS policy,
column-level `GRANT`/`REVOKE` protection on sensitive `profiles` columns,
5 admin metrics views, and a `bump_rate_limit` RPC built for serverless
correctness from the start. **Not yet pushed to the live project**, this
is a genuinely hard-to-reverse action that needs a human present, see
`supabase/APPLY.md`.

**Payments: CheckVault (Phase 6)**: Zai deleted outright, no legacy code
path left anywhere. Built a documented provider interface
(`payments/provider.js`), a real HTTP adapter with every undocumented
assumption tagged `// CHECKVAULT-SPEC: confirm with partner docs` in one
file, and a full in-process mock so the entire payment lifecycle demos
end-to-end today. Escrow state machine (CAS-guarded transitions) carried
forward unchanged in spirit. Added automatic late-cancellation fees,
PDF tax invoices/payout statements (`lib/invoices.js`), and a rewritten
CheckVault-based payment-instructions screen in the customer app. Covered
by a real, passing test suite (`npm run test:payments`, 5/5) that exercises
the full lifecycle against the mock provider, no live database needed.

**Product features (Phase 7)**: backend for quotes/offers (server-
authoritative accept with a CAS guard against double-assignment), licence/
insurance credential verification with expiry-driven auto-pause,
availability + service-area matching, and the four daily jobs (recurring
booking spawner, credential expiry sweep, quote expiry sweep, dispute-
window auto-release), all migrated and covered by `npm run test:cron`
(4/4). **Frontend UI for these six features was not built into the
monolith HTML files in this pass** (see `DECISIONS.md`), the API surface is
ready to consume. Job evidence photos need no new backend work, RLS plus
direct Supabase Storage upload already covers that flow.

**Vercel deployment (Phase 8)**: the whole app runs as one serverless
function (`api/index.js`), with a separate daily Cron function
(`api/cron/daily.js`). Rate limiting on checkout/onboarding now uses the
DB-backed `bump_rate_limit` RPC rather than in-memory counters, which
would silently under-count once serverless functions run across many
containers. Full setup and cutover instructions in `DEPLOY.md`.

**Final verification (Phase 9)**: `node --check` clean across all 40 JS
files, every HTML file has `lang="en-AU"`, all manifests/`vercel.json`/
`package.json` are valid JSON, no leaked service-role keys or JWT-shaped
secrets in any client-served file, zero remaining Zai/OTP/biometric
references anywhere real (a handful of coincidental "zai" substrings
inside base64-encoded image data were checked and are not real references).
New `scripts/check-links.mjs` (1299 links checked, all resolve) and
`scripts/check-copy.mjs` (em dash / AI-tell / US-spelling sweep, with code-
line filtering so CSS custom properties and Schema.org spec keys don't
false-positive) are now part of the repo for future runs.

## Bugs found and fixed during this build (not present before, or long-
## standing but never triggered until now)

- `payments/escrow.js`'s fallback ledger path read a booking column
  (`amount_cents`) that only exists on a *different* table
  (`transactions`), the real column is `total_cents`. Masked in the normal
  flow, would have silently broken every dispute-window auto-release once
  the daily cron started running. Found by actually running the cron test
  suite, not by inspection.
- `vercel.json` was missing rewrites for `/auth/callback`, `/reset-
  password`, `/apps`, and `/complaints`, present in `server.js`'s clean-URL
  map but never carried over. Since only `/api/*` now routes through the
  Express app on Vercel, `/auth/callback` 404ing would have broken the
  entire OAuth sign-in flow in production. Found by diffing the two maps
  programmatically, not by manual review.
- The pre-existing `.vercelignore` excluded the entire root `/assets/`
  directory (meant to target `crew-app/`'s own nested assets, already
  covered separately), which would have 404'd the site logo and every
  per-role PWA icon on every deployed page.
- `/api/ai` was hardcoded to `http://localhost:11434` with no Anthropic
  fallback and no graceful failure, despite `.env.example` documenting an
  Anthropic-first/Ollama-fallback/graceful-503 design. This would have
  failed on every request in production (no Ollama instance is reachable
  from a Vercel serverless function). Rewritten to actually implement the
  documented behaviour.

## What still needs a human before real users see this

1. Legal review of `terms.html`, `privacy.html`, `complaints.html` (marked
   `DRAFT` in the HTML itself).
2. `supabase db push` (or the Dashboard equivalent in `supabase/APPLY.md`)
   against the real project, plus the 3 Storage buckets.
3. Real CheckVault credentials and API docs, then reconcile every
   `// CHECKVAULT-SPEC` comment in `payments/checkvault-client.js` (see
   `DEPLOY.md`'s cutover section). Ships in `mock` mode until then.
4. Link the Vercel project (`vercel link`) and set every env var from
   `.env.example`, then run through `DEPLOY.md`'s verification checklist.
5. Google/Apple OAuth provider setup in the Supabase dashboard (`AUTH_SETUP.md`).
6. Frontend UI for the Phase 7 features (quotes, recurring bookings, job
   photo gallery, credential upload, availability grid, admin metrics
   panel), the backend is ready and tested, the screens are not built.
