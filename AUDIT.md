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
- [x] Home, About, For Contractors, Case Studies, Blog index
- [x] Apps page (install cards, APK links, QR codes, iOS instructions)
- [x] Terms, Privacy, Complaints (port drafted copy, keep DRAFT markers)
- [x] 404, offline

### Auth
- [x] /login (Google, Apple behind flag, email+password, forgot password)
- [x] /auth/callback (PKCE, beta gate, profile retry, role redirect)
- [x] /reset-password
- [x] Private-beta refusal screen
- [x] Role-based route protection middleware

### /customer + /portal
- [x] Service browse/search by category (incl. Tree Lopping)
- [x] Booking creation: fixed price or Get Quotes, address/suburb,
      scheduling, Repeat (weekly/fortnightly/monthly)
- [x] Quotes review (ranked, accept/decline, Realtime)
- [x] Checkout: CheckVault payment instructions, copy-to-clipboard,
      awaiting-clearance -> funds-secured live flip
- [x] Bookings list/detail: escrow timeline, photo gallery, invoice
      download, dispute, cancel with fee shown pre-confirm
- [ ] Recurring management (skip/change frequency/end series) - DEFERRED,
      logged in DECISIONS.md (Phase 4). recurrence_rule/recurrence_remaining/
      recurrence_next_at are written correctly at booking creation and
      consumed by the existing cron spawner; only the management UI for an
      in-flight series is missing.
- [ ] Ratings - DEFERRED, logged in DECISIONS.md (Phase 4/5).
      bookings.rating/rating_note exist and are read elsewhere
      (contractor_public_profiles); no submission screen was built.
- [x] Profile/settings (push toggle, account deletion request)
- [x] Notifications screen
- [x] Messaging (real channels/messages, not localStorage)
- [x] /portal resolves via a next.config.ts redirect to
      /customer/notifications (Phase 9): it was only ever referenced in the
      backend as a notification deep-link target, never specced as a
      distinct surface, see DECISIONS.md.

### /pro (contractor)
- [x] Open jobs near you, filtered by pricing_mode='quoted' and
      contractor_id IS NULL. Not further filtered by service-area/
      availability match, logged as a simplification in DECISIONS.md
      (Phase 5): the backend has no matching endpoint for this filter,
      it would need a new one, deferred as out of scope for this pass.
- [x] Quote submission
- [x] Assigned jobs: job-complete (there is no accept/en-route/start
      state in the schema at all, escrow_state and job_completed_at are
      the only real tracked states; the legacy UI's finer-grained labels
      were decorative, not backed by data, so the actual transition
      built here, PAYMENT_HELD -> job-complete, is the full set that
      exists)
- [x] Before/after photo capture with client-side downscale
- [x] Earnings/ledger/payout breakdown/invoice downloads (payout shown
      as a 90% commission estimate, not each booking's exact ledger_json
      figure, see DECISIONS.md Phase 5)
- [x] CheckVault seller onboarding (KYC + bank account)
- [x] Credentials (licence/insurance/photo ID, expiry, paused banner)
- [x] Availability grid + exceptions (weekly grid; per-date exceptions
      table exists but no UI was built for one-off date overrides)
- [x] Service-area postcode chips
- [ ] Ratings received - DEFERRED, same as customer-side ratings above.
- [x] SOS button
- [x] Settings

### /manager
- [x] Team overview, job assignment across crew members
- [x] Org onboarding (KYB)
- [x] Org earnings/ledgers

### /field
- [x] Job list, today view, status transitions, photos, SOS

### /supervisor
- [x] Multi-crew oversight, job map (list + outbound map links, not an
      embedded map library, see DECISIONS.md Phase 6), approvals
      (read-only dispute visibility; resolution is admin-only)

### /command
- [x] Metrics panel (5 views) with inline charts (no date-range picker
      was built; all five views show their full available history/last
      30 days fixed, not a user-adjustable range)
- [x] Bookings/escrow admin (manual release/refund, dispute resolution -
      resolve-dispute route added in Phase 7, did not exist before)
- [x] Credential verification queue
- [x] User/org management (pause/unpause with reason)
- [x] Community reports queue
- [x] Beta allowlist management
- [x] Login activity

### PWA
- [x] 6 manifests, per-surface app shell, offline fallback, push handlers,
      install prompt, iOS meta (appleWebApp in the root layout metadata),
      update-available toast (genuine updates only)

## Out of scope for this pass (no backing table, decorative in legacy)

Loyalty/rewards points and streaks, weather widgets/alerts, carbon
tracking, smart home integration, tarot/"Rising Star" gamification,
rental management, referral trees, multi-property portfolios, OCR
document scan, printable forms library, visitor management, budget/
asset tracking, marketplace/store/product ordering, group booking,
neighbourhood features, seasonal promotions, warranty tracking. All
remain in `legacy/` for reference.
