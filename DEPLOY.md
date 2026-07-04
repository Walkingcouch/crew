# Deploying Crew to Vercel

## Architecture

The whole Express app (`server.js`) runs as a single Vercel serverless
function via `api/index.js`. Static HTML/CSS/JS/images are served directly
by Vercel's own hosting (not by the function), per the `headers` array in
`vercel.json`. `vercel.json`'s `rewrites` route:

- `/api/(.*)` to that one function (except `/api/cron/daily`, protected by
  an earlier explicit rule so it keeps hitting its own file-based function)
- every clean URL (`/login`, `/customer`, `/dashboard`, ...) to its HTML file

`api/cron/daily.js` is a separate serverless function, triggered once a
day by the `crons` entry in `vercel.json` (`0 15 * * *`, i.e. 01:00 AEST /
midnight AEDT). It calls the same `lib/cron-jobs.js` logic as
`scripts/run-cron.js`.

## First-time setup

1. **Push the schema** (only once you're ready, this touches the live
   database): `supabase login && supabase link --project-ref ggocdbsspynihtqlgozv
   && supabase db push`. See `supabase/APPLY.md` for the manual Dashboard
   alternative and Storage bucket setup. This was **not** run autonomously
   during the build, since pushing a schema to a live project is exactly
   the kind of hard-to-reverse action that needs a human to actually watch
   it happen.

2. **Set every environment variable from `.env.example`** in the Vercel
   project dashboard (Settings -> Environment Variables), for both
   Production and Preview. Generate secrets:
   ```
   npx web-push generate-vapid-keys        # VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # PUSH_DISPATCH_SECRET, CRON_SECRET
   ```
   Leave `CHECKVAULT_ENVIRONMENT=mock` until real CheckVault credentials
   arrive; every payment flow works end-to-end in mock mode (see below).

3. **Connect the GitHub repo** to a new Vercel project. Framework preset:
   "Other" (no build step, `buildCommand` is intentionally empty in
   `vercel.json`, everything runs from source).

4. **Supabase Auth redirect URLs**: add `https://<your-domain>/auth/callback`
   to Supabase Dashboard -> Authentication -> URL Configuration -> Redirect
   URLs, for every domain the app is reachable on (production + any preview
   domains you test auth against).

5. **Supabase Database Webhook for push notifications** (optional, only
   needed if something outside `lib/notify.js` inserts into `notifications`
   directly, e.g. a future DB trigger): Database -> Webhooks -> new webhook
   on `notifications` INSERT, HTTP POST to
   `https://<your-domain>/api/push/dispatch`, header
   `X-Push-Dispatch-Secret: <PUSH_DISPATCH_SECRET>`.

## CheckVault cutover (mock -> test -> production)

1. **mock** (default): `payments/checkvault-mock.js` handles everything
   in-process, no real credentials needed, `/api/payments/mock/clear-funds`
   simulates a bank transfer clearing. This is what ships until real
   CheckVault credentials exist.
2. **test**: once CheckVault provides sandbox credentials and API docs, set
   `CHECKVAULT_ENVIRONMENT=test`, fill in `CHECKVAULT_API_URL` /
   `CHECKVAULT_API_KEY` / `CHECKVAULT_API_SECRET` / `CHECKVAULT_WEBHOOK_SECRET`,
   and go through every `// CHECKVAULT-SPEC: confirm with partner docs`
   comment in `payments/checkvault-client.js` (endpoint paths, payload field
   names, webhook envelope shape, status enum values) against the real
   docs, correcting the `ENDPOINTS` map and field names as needed. This is
   a one-file reconciliation by design.
3. **production**: same file, `CHECKVAULT_ENVIRONMENT=production`, real keys.

## Verifying the deployment

```bash
vercel build                                    # confirms the build succeeds
vercel dev                                      # local Vercel-parity server, including api/cron/daily
npm run test:payments                           # escrow lifecycle, 5 tests
npm run test:cron                               # daily cron jobs, 4 tests
node scripts/run-cron.js                        # runs the real cron jobs once against your live SUPABASE_URL
```

Once deployed, curl every clean-URL rewrite to confirm nothing 404s:

```bash
for path in /login /customer /contractor /manager /dashboard /command /portal /apps /terms /privacy /complaints; do
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

Locally (`npm run dev` / `node server.js`), the whole app including static
files, clean URLs, and every `/api/*` route all come from the one Express
process on `PORT` (default 3000). `/api/cron/daily` is the one exception:
it's a Vercel-only serverless function with no equivalent Express route in
`server.js`, so locally it 404s under plain `node server.js`. Use
`vercel dev` (which reads `vercel.json` and serves every `api/` file the
same way Vercel's platform does) or `node scripts/run-cron.js` (runs the
exact same job functions directly) to exercise it before relying on the
schedule.
