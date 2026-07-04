# Crew Rebuild: Parity Map (Phase 0)

Regenerated for the Next.js rebuild. This replaces the old Zai-era audit
entirely. Extracted from the legacy monoliths via `grep`/`sed` (screen IDs,
`fetch()` calls), never by reading the multi-megabyte files whole, and
cross-referenced against `supabase/migrations/0001_init.sql` (the real
source of truth for what has a backend) and the existing `/api` contracts.

## The central finding

The legacy customer/contractor/manager app files each define 150 to 200
`id="s-..."` screens (loyalty points, weather widgets, carbon tracking,
smart home control, tarot-style "rising star" gamification, rental
management, referral trees, OCR document scan, printable forms, visitor
management, budget/assets). Grepping every `.html` file for `fetch('/api/`
finds exactly two real calls in the entire legacy frontend: `/api/config`
and `/api/payments/checkout-session`. Every other screen is decorative,
never wired to Supabase or the real API, no matter how complete it looks.

**Decision (logged in DECISIONS.md too): the rebuild's scope is every
screen backed by a real table, RPC, or `/api` contract. The long tail of
demo-only screens is out of scope for this pass** and is left behind in
`legacy/` as reference, not rebuilt. This is the single biggest scope call
in the whole rebuild; flagging it loudly here rather than either
attempting 150+ screens with no data behind them or silently dropping
them without saying so.

## In-scope tables (supabase/migrations/0001_init.sql)

`profiles`, `organisations`, `bookings`, `escrow_events`, `transactions`,
`webhook_events`, `notifications`, `admin_notifications`,
`beta_allowlist`, `community_reports`, `login_attempts`, `rate_limits`,
`push_subscriptions`, `channels`, `channel_members`, `messages`, `quotes`,
`job_photos`, `contractor_credentials`, `availability`,
`availability_exceptions`, `service_areas`, `invoices`.

Views: `contractor_public_profiles`, `metrics_gmv_daily`,
`metrics_take_rate`, `metrics_disputes`, `metrics_time_to_match`,
`metrics_contractor_utilisation`.

RPCs: `is_beta_allowed`, `bump_rate_limit`, `recalc_contractor_rating`,
`is_admin`, `handle_new_user`, `set_updated_at`.

## Existing `/api` contracts to port one-for-one as Route Handlers

```
POST /api/payments/checkout-session
POST /api/payments/job-complete
POST /api/payments/approve-release
POST /api/payments/dispute
POST /api/payments/refund
POST /api/payments/cancel
GET  /api/payments/ledger/:bookingId
GET  /api/payments/status/:bookingId
GET  /api/payments/invoice/:bookingId
POST /api/payments/mock/clear-funds
POST /api/onboarding/sole-trader
POST /api/onboarding/enterprise
POST /api/onboarding/bank-account
GET  /api/onboarding/status/:providerAccountId
POST /api/quotes
GET  /api/quotes/:bookingId
POST /api/quotes/:id/accept
POST /api/quotes/:id/decline
POST /api/quotes/:id/withdraw
POST /api/credentials
GET  /api/credentials
GET  /api/credentials/verification-queue
POST /api/credentials/:id/verify
POST /api/credentials/:id/reject
GET  /api/availability
PUT  /api/availability
POST /api/availability/exception
DELETE /api/availability/exception/:date
GET  /api/service-areas
PUT  /api/service-areas
GET  /api/service-areas/match/:postcode
GET  /api/admin/metrics
GET  /api/push/vapid-public-key
POST /api/push/subscribe
POST /api/push/unsubscribe
POST /api/push/send
POST /api/push/dispatch
POST /api/webhooks/checkvault
GET  /api/config
GET  /api/session
POST /api/ai
GET  /api/cron/daily (Vercel Cron only)
```

New Route Handlers this rebuild adds (backed by tables above, no
corresponding legacy screen ever existed): messaging (`channels`,
`channel_members`, `messages`), community reports admin queue, login
activity, beta allowlist admin CRUD, org pause/unpause.

## Rebuild checklist by surface

### Marketing (no auth)
- [ ] Home, About, For Contractors, Case Studies, Blog index
- [ ] Apps page (install cards, APK links, QR codes, iOS instructions)
- [ ] Terms, Privacy, Complaints (port drafted copy, keep DRAFT markers)
- [ ] 404, offline

### Auth
- [ ] /login (Google, Apple behind flag, email+password, forgot password)
- [ ] /auth/callback (PKCE, beta gate, profile retry, role redirect)
- [ ] /reset-password
- [ ] Private-beta refusal screen
- [ ] Role-based route protection middleware

### /customer + /portal
- [ ] Service browse/search by category (incl. Tree Lopping)
- [ ] Booking creation: fixed price or Get Quotes, address/suburb,
      scheduling, Repeat (weekly/fortnightly/monthly)
- [ ] Quotes review (ranked, accept/decline, Realtime)
- [ ] Checkout: CheckVault payment instructions, copy-to-clipboard,
      awaiting-clearance -> funds-secured live flip
- [ ] Bookings list/detail: escrow timeline, photo gallery, invoice
      download, dispute, cancel with fee shown pre-confirm
- [ ] Recurring management (skip/change frequency/end series)
- [ ] Ratings
- [ ] Profile/settings (push toggle, account deletion request)
- [ ] Notifications screen
- [ ] Messaging (real channels/messages, not localStorage)

### /pro (contractor)
- [ ] Open jobs near you (service-area + availability filtered)
- [ ] Quote submission
- [ ] Assigned jobs: accept, en route, start, job-complete
- [ ] Before/after photo capture with client-side downscale
- [ ] Earnings/ledger/payout breakdown/invoice downloads
- [ ] CheckVault seller onboarding (KYC + bank account)
- [ ] Credentials (licence/insurance/photo ID, expiry, paused banner)
- [ ] Availability grid + exceptions
- [ ] Service-area postcode chips
- [ ] Ratings received
- [ ] SOS button
- [ ] Settings

### /manager
- [ ] Team overview, job assignment across crew members
- [ ] Org onboarding (KYB)
- [ ] Org earnings/ledgers

### /field
- [ ] Job list, today view, status transitions, photos, SOS

### /supervisor
- [ ] Multi-crew oversight, job map, approvals

### /command
- [ ] Metrics panel (5 views) with date range + inline charts
- [ ] Bookings/escrow admin (manual release/refund, dispute resolution)
- [ ] Credential verification queue
- [ ] User/org management (pause/unpause with reason)
- [ ] Community reports queue
- [ ] Beta allowlist management
- [ ] Login activity

### PWA
- [ ] 6 manifests, per-surface app shell, offline fallback, push handlers,
      install prompt, iOS meta, update-available toast (genuine updates only)

## Out of scope for this pass (no backing table, decorative in legacy)

Loyalty/rewards points and streaks, weather widgets/alerts, carbon
tracking, smart home integration, tarot/"Rising Star" gamification,
rental management, referral trees, multi-property portfolios, OCR
document scan, printable forms library, visitor management, budget/
asset tracking, marketplace/store/product ordering, group booking,
neighbourhood features, seasonal promotions, warranty tracking. All
remain in `legacy/` for reference.
