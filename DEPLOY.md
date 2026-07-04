# Deploying Crew to Vercel

## Architecture (Next.js rebuild)

The app is a single Next.js (App Router) project deployed as one Vercel
project, standard framework preset, no custom `vercel.json` rewrites
needed. Route Handlers under `src/app/api/**/route.ts` replace the old
`api/index.js` Express wrapper, most of them adapt the same tested
Express routers from `src/server/payments/routes.js` and
`src/server/lib/*-routes.js` via `src/server/lib/express-adapter.ts`,
rather than being hand-translated one at a time. `src/app/api/cron/daily/route.ts`
and `src/app/api/webhooks/checkvault/route.ts` are dedicated Route
Handlers (raw body access for the webhook's HMAC check, `CRON_SECRET`
bearer check for the cron route) that call the underlying job/webhook
functions directly rather than going through the Express adapter.

Six per-surface PWA manifests (`/manifest-customer.json`, `-pro`,
`-manager`, `-field`, `-supervisor`, `-command`) are Route Handlers built
from `src/server/lib/manifest.ts`. The service worker (`public/sw.js`)
is hand-rolled (see `DECISIONS.md`, Phase 8), not Serwist.

`middleware.ts` at the repo root handles: unauthenticated-user redirects
to `/login?next=...`, role-mismatch redirects to the visitor's own
surface home, subdomain-to-surface routing for the TWA builds, and the
Supabase session-cookie refresh via `src/lib/supabase/middleware.ts`.

## First-time setup

1. **Push the schema** (only once you're ready, this touches the live
   database): `supabase login && supabase link --project-ref ggocdbsspynihtqlgozv
   && supabase db push`. See `supabase/APPLY.md` for the manual Dashboard
   alternative and Storage bucket setup (`job-photos`, `credentials`,
   `invoices`). This was **not** run autonomously during either build pass,
   pushing a schema to a live project is exactly the kind of hard-to-reverse
   action that needs a human to actually watch it happen.

2. **Set every environment variable from `.env.example`** in the Vercel
   project dashboard (Settings -> Environment Variables), for both
   Production and Preview. `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` are client-safe by name and design;
   `SUPABASE_SERVICE_ROLE_KEY` and every CheckVault credential must never
   carry the `NEXT_PUBLIC_` prefix; a grep across `src/app/**/*.tsx` and
   `src/components/` for `SERVICE_ROLE` should always come back empty
   (`npm run check:copy`'s remit could be extended to this if it ever
   isn't). Generate secrets:
   ```
   npx web-push generate-vapid-keys        # VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # PUSH_DISPATCH_SECRET, CRON_SECRET
   ```
   Leave `CHECKVAULT_ENVIRONMENT=mock` until real CheckVault credentials
   arrive; every payment flow works end-to-end in mock mode (see below).

3. **Connect the GitHub repo** to a new Vercel project. Framework preset:
   "Next.js" (auto-detected). Build command: `next build` (default).

4. **Supabase Auth redirect URLs**: add `https://<your-domain>/auth/callback`
   to Supabase Dashboard -> Authentication -> URL Configuration -> Redirect
   URLs, for every domain the app is reachable on (production + any preview
   domains you test auth against).

5. **Supabase Database Webhook for push notifications** (optional, only
   needed if something outside `src/server/lib/notify.js` inserts into
   `notifications` directly, e.g. a future DB trigger): Database -> Webhooks
   -> new webhook on `notifications` INSERT, HTTP POST to
   `https://<your-domain>/api/push/dispatch`, header
   `X-Push-Dispatch-Secret: <PUSH_DISPATCH_SECRET>`.

## CheckVault cutover (mock -> test -> production)

1. **mock** (default): `src/server/payments/checkvault-mock.js` handles
   everything in-process, no real credentials needed,
   `/api/payments/mock/clear-funds` simulates a bank transfer clearing.
   This is what ships until real CheckVault credentials exist.
2. **test**: once CheckVault provides sandbox credentials and API docs, set
   `CHECKVAULT_ENVIRONMENT=test`, fill in `CHECKVAULT_API_URL` /
   `CHECKVAULT_API_KEY` / `CHECKVAULT_API_SECRET` / `CHECKVAULT_WEBHOOK_SECRET`,
   and go through every `// CHECKVAULT-SPEC: confirm with partner docs`
   comment in `src/server/payments/checkvault-client.js` (endpoint paths,
   payload field names, webhook envelope shape, status enum values)
   against the real docs, correcting the `ENDPOINTS` map and field names
   as needed. This is a one-file reconciliation by design.
3. **production**: same file, `CHECKVAULT_ENVIRONMENT=production`, real keys.

## Verifying the deployment

```bash
npm run build                                   # confirms the Next.js build succeeds
npm run start                                   # local production-mode server, port 3000
npm run test:payments                           # escrow lifecycle, 5 tests
npm run test:cron                               # daily cron jobs, 4 tests
npm run test:e2e                                # Playwright: manifests, service worker, offline fallback
node scripts/run-cron.js                        # runs the real cron jobs once against your live SUPABASE_URL
```

Once deployed, curl every surface home to confirm the auth redirect and
middleware are wired correctly (each should 307 to `/login?next=...` when
signed out):

```bash
for path in /customer /pro /manager /field /supervisor /command; do
  echo -n "$path: "; curl -s -o /dev/null -w "%{http_code}\n" "https://<your-domain>$path"
done
```

Full mock payment lifecycle, against the deployed API (replace `$TOKEN`
with a real Supabase session access_token for a test customer account):

```bash
curl -s -X POST https://<your-domain>/api/payments/checkout-session \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"bookingId":"<a real booking id in PAYMENT_PENDING or earlier>"}'
# -> { providerEscrowId, paymentInstructions: { bsb, accountNumber, reference }, ledger, cardEnabled }

curl -s -X POST https://<your-domain>/api/payments/mock/clear-funds \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"bookingId":"<same booking id>"}'
# -> booking should now show escrow_state: PAYMENT_HELD
```

Cron: trigger `/api/cron/daily` manually once with the real `CRON_SECRET` to
confirm it runs clean before trusting the schedule:

```bash
curl -s https://<your-domain>/api/cron/daily -H "Authorization: Bearer $CRON_SECRET"
```

## What changed from local dev

Locally (`npm run dev`), `next dev` serves everything, App Router pages,
Route Handlers, and the six manifest routes, on `PORT` (default 3000),
no separate Vercel-only function to worry about the way the old
`api/cron/daily.js` was. `npm run start` (after `npm run build`) is the
closest local match to how Vercel actually serves the deployed app.
