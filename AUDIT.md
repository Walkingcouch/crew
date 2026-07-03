# Crew Platform: Audit Report

**Date:** 2026-07-04
**Phase 0: regenerated from scratch. Read-only inventory; supersedes the previous AUDIT.md.**

A prior session had already attempted Phases 0 to 2 (see git log: "Phase 0", "Phase 1a/1", "Phase 2" commits). This audit does not trust that work; every finding below was re-verified against the codebase as it stands today. Where the earlier session's work is confirmed correct it is marked DONE. Where it is missing, partial or wrong it is marked as an open item and carried into the phase that owns the fix.

---

## 1. HTML Inventory

### Monolith app files (inline styles + scripts, over 300KB: edit only via patch scripts per the large-file rule)

| File | Size | server.js route |
|---|---|---|
| Crew_App_Customer_Role.html | 3,114 KB | /customer |
| Crew_App_Crew_Member.html | 2,804 KB | /contractor |
| Crew_App_Crew_Manager.html | 2,647 KB | /manager |
| index.html | 2,556 KB | static root |
| Command_Center_Desktop.html | 985 KB | /command |
| Command_Center_Tablet.html | 983 KB | /command/tablet |
| CrewBase_Dashboard.html | 759 KB | /dashboard |

### Other app / internal pages

| File | Size | server.js route |
|---|---|---|
| CrewBase_Supervisor_App.html | 197 KB | /supervisor |
| CrewBase_Field_Worker_App.html | 78 KB | /field |
| Customer_Portal.html | 57 KB | /portal |
| Crew_App_Enterprise_Team_Member.html | 83 KB | none |
| Crew_App_Enterprise_Team_Leader.html | 54 KB | none |
| CrewBase_Printable_Forms.html | 53 KB | none |
| CrewBase_Budget_Assets.html | 38 KB | none |
| CrewBase_Visitor_Management.html | 36 KB | none |
| Crew_App_Controls.html | 34 KB | none |
| CrewBase_App_Controls.html | 28 KB | none |
| CrewBase_OCR_Scan.html | 24 KB | none |
| documentation/SUPABASE_SETUP.html | 10 KB | dev doc, not routed |

### Marketing / legal pages

auth.html (131 KB, routed /login /signin), about, blog, case-studies, contractors, downloads, enterprise, escrow, get-started, gate, help, privacy, terms, trust, rewards, rewards-tc, report, report-lead-gen-email: all present. **Correction to the previous version of this audit:** server.js's clean-URL map already includes every one of these routes (`/about`, `/blog`, `/case-studies`, `/contractors`, `/downloads`, `/enterprise`, `/escrow`, `/get-started`, `/gate`, `/help`, `/privacy`, `/terms`, `/trust`): confirmed by direct read of server.js lines 106-144. No route gap exists here; this was carried forward incorrectly from the prior audit without re-checking against the server.js already read in this pass. No Phase 1 action needed.

report-lead-gen-email.html has no route anywhere (it is an email template rendered by Resend, not a page: correct as-is, no route needed).

### Utility pages

404.html (4 KB) and offline.html (4.6 KB) both exist and are branded already (framework colours present). DONE from the earlier session.

### MISSING pages (required by later phases, not yet created)

apps.html (Phase 4), complaints.html (Phase 4), reset-password.html (Phase 3), auth/callback.html (Phase 3).

---

## 2. Broken Links

Script-based scan of every `href=`, `src=`, `action=`, `window.location`/`location.href` assignment, and `fetch()` call across all HTML and JS files (`scripts/` audit script written for this pass, not retained). After excluding server.js clean routes, API endpoints and external URLs, two real problems were found:

1. **`crew-demo-data.js` and `crew-integration-e2e.js` do not exist** but are referenced via `<script src="crew-demo-data.js">` / `<script src="crew-integration-e2e.js">` in 15 files: Command_Center_Desktop.html, Command_Center_Tablet.html, CrewBase_App_Controls.html, CrewBase_Budget_Assets.html, CrewBase_Dashboard.html, CrewBase_Field_Worker_App.html, CrewBase_OCR_Scan.html, CrewBase_Printable_Forms.html, CrewBase_Supervisor_App.html, CrewBase_Visitor_Management.html, Crew_App_Controls.html, Crew_App_Crew_Manager.html, Crew_App_Crew_Member.html, Crew_App_Customer_Role.html, Crew_App_Enterprise_Team_Leader.html, Crew_App_Enterprise_Team_Member.html, Customer_Portal.html. These files were deleted as orphans by the earlier session, but the `<script>` tags that loaded them were never removed. Every page load throws a 404 in the browser console. **Phase 1 must remove these dead script tags.**

2. **Cloudflare email-decode artifact**: `<script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js">` is baked into Command_Center_Desktop.html (×2), Command_Center_Tablet.html (×2), and CrewBase_Dashboard.html (×2). This path is only ever served by Cloudflare's edge (email address obfuscation) and will 404 on Vercel. Dead weight. **Phase 1 must remove.**

All other apparent "broken" targets (`/login`, `/customer`, `/privacy`, `/api/payments/...` etc.) resolve correctly through server.js's clean-URL map or are legitimate API routes: not actual defects.

---

## 3. Service Worker Shell Array

`sw.js` VERSION is already `crew-v4` (bumped by the earlier session). SHELL array:

| Path | Exists |
|---|---|
| /auth.html | YES |
| /index.html | YES |
| /manifest.json | YES |
| /404.html | YES |
| /offline.html | YES |
| /crew-framework.js | YES |
| /active-jobs-panel.js | YES |

All resolve. **However**, the install handler still does `cache.addAll(SHELL).catch(() => {})`: a single try/catch around the whole array. `cache.addAll` is atomic: if any one request in the array fails, the entire call rejects and **none** of the files get cached, silently (the outer catch swallows it with no console.warn identifying which file failed). This is exactly the bug Phase 2 must fix: per-file `cache.add()` each in its own catch. **NOT fixed despite crew-v4 bump: open item.**

---

## 4. manifest.json Asset Check

Only one shared manifest.json exists (icon.svg, icon-192/512.png + .webp all present in /icons/). Six per-role manifests (Phase 4) do not exist yet. assets/icons/ role-badge variants do not exist yet. **No file at assets/logo_Crew.png, and no Crew logo PNG anywhere in the repo** (searched by filename pattern `*logo*crew*` / `*crew*logo*` and `**/logo*.png`: zero hits). Per the autonomous defaults, Phase 4 will generate a clean interim "Crew" wordmark icon on #1a4d33 and flag it in DECISIONS.md/RELEASE_NOTES.md for replacement with the official logo.

---

## 5. Orphan Files

**Correction to the previous version of this audit:** the one-off patch/build scripts listed in the prior AUDIT.md (`_patch_auth_guard.js`, `_patch_nav_footer.js`, `_patch_rewards.js`, `add-new-chat.js`, `fix-chat.js`, `fix-new-chat-location.js`, `fix-rentals-2.js`, `embed-screenshots.js`, `take-screenshots.js`, `pwa-fix-body.js`, `pwa-gen-icons.js`, `pwa-patch.js`, `upgrade-handover.js`, `upgrade-rentals.js`, `patch-demo-data.js`, `patch-email-cert.js`, `messaging-team-item-fix.js`, `messaging-ui-mobile.js`, `build-apks.sh`) **have already been deleted**: confirmed by direct `ls` check, all return "No such file". The earlier session's orphan cleanup genuinely happened here; this was carried forward as still-outstanding without re-checking. No Phase 1 action needed for this item.

The only real remaining orphan-adjacent issue is the dead `<script src="crew-demo-data.js">` / `crew-integration-e2e.js"` references covered in §2: the *scripts that loaded them* were deleted, but the `<script>` tags referencing them were not. **Fixed in this pass** (see §2 and the Phase 1 commit).

**Also found:** a stray git worktree at `.claude/worktrees/agent-a379f348930be3706/` (branch `worktree-agent-a379f348930be3706`) left over from a previous agent run, containing a full second checkout of the repo (still on the old Zai/OTP code). This is not part of the working tree proper and is not touched by this run; noted in DECISIONS.md rather than deleted, since worktree cleanup was not requested and may hold another session's in-progress work.

---

## 6. Hardcoded Credentials

**Supabase anon key**: still hardcoded in ~15 files (auth.html, crew-framework.js as fallback, and most CrewBase_*/Crew_App_Enterprise_* files). This is intentionally public (RLS provides the real security boundary, not key secrecy) but is a rotation/maintenance smell. Not yet centralised. Carried forward as a nice-to-have; not a security defect, not blocking.

**Supabase service-role key**: confirmed used via `process.env.SUPABASE_SERVICE_ROLE_KEY` only in server-side files (`payments/*.js`, `lib/*.js`). Grep for `SERVICE_ROLE` across all `.html` files returns zero hits. **CORRECT: no leakage.**

**`payments/routes.js` still calls `createClient()` with the service-role key inline in almost every handler** (9+ locations) instead of a module-level singleton. Wasteful, not a security bug. Carried to Phase 6 cleanup.

---

## 7. Zai Touchpoint Map (all to be deleted/replaced in Phase 6)

Zai is still fully wired in, unchanged from the pre-existing codebase: the earlier session's Phase 2 commit did NOT touch payments logic for CheckVault (correct, since that's Phase 6 work, not Phase 2).

| File | Zai references |
|---|---|
| payments/zai-client.js | 39 (entire file: full Zai HTTP client) |
| payments/escrow.js | 96 (entire state machine calls zai.* directly; CAS added on top, see §9) |
| payments/onboarding.js | 104 |
| payments/webhooks.js | 78 |
| payments/checkout.js | 73 |
| payments/routes.js | 28 (webhook path `/api/webhooks/zai`, `tokenize-card`, `zai_user_id` references) |
| payments/gst.js | 6 (`zaiFeeCents` field name) |
| server.js | 7 (raw-body exclusion for `/api/webhooks/zai`, comment references) |
| index.html, Crew_App_Customer_Role.html, Crew_App_Crew_Member.html, Crew_App_Crew_Manager.html, auth.html, Command_Center_Desktop/Tablet.html, CrewBase_Dashboard.html | UI copy / CSP references |
| screenshots/*.json | `zai_user_id` sample field |

server.js CSP (`helmet` config) still whitelists `js.assemblypayments.com`, `assembly-prelive.s3.amazonaws.com`, `api.assemblypayments.com`, `api.sandbox.assemblypayments.com`, `*.auth.assemblypayments.com`. **All to be removed in Phase 6, replaced with `*.checkvault.com.au`.**

---

## 8. Auth Touchpoint Map

`auth.html` (133 KB) contains, confirmed by direct scan:

- **108 OTP-related occurrences** (`signInWithOtp`, `verifyOtp`, OTP input UI): full magic-link/OTP flow.
- **14 magic-link string occurrences.**
- **33 occurrences of `navigator.credentials` / WebAuthn / biometric / passkey code**: a full biometric registration and sign-in flow with OTP fallback. This directly violates the NO BIOMETRICS ground rule and must be deleted entirely in Phase 3, not just hidden.
- **1 Google OAuth reference** (`provider: 'google'`): present but needs verification of the redirect/callback path.
- **0 Apple OAuth references**: not implemented; Phase 3 must add it behind `AUTH_APPLE_ENABLED`.
- `lang="en-AU"` is already set on auth.html's `<html>` tag (earlier session's work: confirmed correct).

`documentation/supabase_client.js` also references `signInWithOtp`/magic-link patterns (dev reference doc, not live code, but will be updated for consistency in Phase 3).

---

## 9. Security Audit: payments/routes.js and lib/require-user.js

### Q1: Does each payment/onboarding endpoint verify the Supabase JWT server-side?

**YES.** `lib/require-user.js` exists (new since the last audit) and does real work: extracts the Bearer token, calls `supabase.auth.getUser(token)` using a service-role client, sets `req.user`. All payment and onboarding routes in `routes.js` use `requireAuth` (aliased from `requireUser`). **CORRECT.**

### Q2: Does `/api/payments/refund` verify `profiles.role IN ('admin','crewbase_admin')` from the DATABASE?

**YES.** Uses `requireAdmin` from `lib/require-user.js`, which queries `profiles.role` via the service-role client and checks `role !== 'admin' && role !== 'crewbase_admin'`. Not trusting any client-supplied field. **CORRECT.**

### Q3: Does approve-release verify caller is customer_id? job-complete verify contractor_id? dispute verify caller is a party?

- **approve-release:** queries the booking `.eq('customer_id', req.user.id)`: booking is only found if the caller is the customer. **CORRECT.**
- **job-complete:** checks `booking.contractor_id === req.user.id` OR admin role from a DB profile lookup. **CORRECT.**
- **dispute:** queries the booking `.eq('customer_id', req.user.id)` only: **the contractor cannot raise a dispute even though the spec says "verify caller is a party to the booking" (i.e. either side).** This is a real, if minor, gap: currently only the paying customer can dispute, not the assigned contractor. **Open item for Phase 2/6 rewrite**: will widen to party-scoped (customer OR contractor) per the spec, logged in DECISIONS.md as the spec winning over existing code.

### Q4: Can any server endpoint be satisfied by demo-mode localStorage, client-supplied roles, or client-supplied user IDs?

**NO.** Demo mode (`crew_auth` in localStorage) is read only by client-side `crew-framework.js`; no server handler reads cookies or body fields for role/user-id in place of the verified JWT. **SAFE**, confirmed by direct code read, not just by the earlier audit's word.

### Q5: Does the webhook handler receive the RAW body for HMAC?

**YES**, confirmed in server.js: `/api/webhooks/zai` (soon `/api/webhooks/checkvault`) is explicitly excluded from the global `express.json()` middleware, and `routes.js` applies `express.raw({ type: 'application/json' })` inline for that route only. **CORRECT** (path renames to `/api/webhooks/checkvault` in Phase 6).

### Q6: Are escrow state transitions atomic (CAS or row lock)?

**YES: fixed since the last audit.** `payments/escrow.js` now has a real `casTransition()` helper: `UPDATE bookings SET escrow_state = :to WHERE id = :id AND escrow_state = :expectedFrom .select('id')`, and treats zero returned rows as a 409 `CONCURRENT_MODIFICATION` error. Every transition function (`chargeCustomer`, `markJobComplete`, `releaseEscrow`, `raiseDispute`, `resolveDispute`, `refundCustomer`, `cancelEscrow`) calls it before touching Zai. **CORRECT: this was the single most important Phase 2 fix and it is genuinely done.** (It will carry through unchanged into the Phase 6 CheckVault rewrite: the CAS logic is provider-agnostic.)

### Additional issues confirmed still present

1. **MEDIUM:** `createClient()` with the service-role key is instantiated fresh in nearly every route handler instead of a module-level singleton. Inefficient, not a vulnerability. Phase 6 cleanup.
2. **LOW:** booking IDs from URL/body params are not validated as UUID format before querying: malformed IDs produce a generic 404 instead of a 400. Cosmetic.
3. **LOW:** `/api/payments/status/:bookingId` returns `zai_item_id` in the response body. Will be renamed/removed with the CheckVault rewrite.
4. **INFO:** the `wrap()` error handler propagates `err.message` verbatim to the HTTP response, which could leak third-party SDK error detail. Phase 6 should sanitise.
5. **CONFIRMED FIXED:** the global rate limiter is already scoped to `/api/*` only (`app.use('/api', apiLimiter)` in server.js): static assets are not throttled. This was flagged as an open item in the previous audit; it is now correctly done.

---

## 10. Web Push / VAPID Audit

**Partially built, but the core `notify()` contract the spec requires does NOT exist yet.**

What exists (new since the last audit):
- `lib/vapid.js`: real VAPID configuration + `sendPush(subscription, payload)` using the `web-push` npm package (already a dependency). Correct shape.
- `lib/push-routes.js`: `GET /api/push/vapid-public-key`, `POST /api/push/subscribe` (upserts ONE subscription per user, keyed by `user_id`, not by `endpoint`), `POST /api/push/send` (admin-only manual send).
- `sw.js` already has correct `push` and `notificationclick` handlers (per spec, keep as-is).

What is missing or wrong against the Phase 2 spec:
- **No `lib/notify.js` with the required `notify(userId, {title, body, link, type})` contract.** The file that exists at `lib/notify.js` is a completely different, pre-existing thing: `notifyAdmin({type, message, meta, email})`, which inserts into an `admin_notifications` table and optionally emails via Resend. **It does not touch the user-facing `notifications` table, does not send Web Push, and is not what any payment/booking event should call.** This must be rewritten.
- **`push_subscriptions` table shape is wrong for multi-device support.** Current usage (`push-routes.js`) upserts on `user_id` (one row per user, overwritten on every new device). The spec (and Phase 5 schema) requires one row per **endpoint** (`id, user_id, endpoint unique, p256dh, auth, user_agent, created_at`), so a user can be subscribed on phone + laptop simultaneously. This must be corrected when Phase 5 migrations and Phase 2 subscribe logic are (re)written.
- **No client-side subscribe flow.** `crew-framework.js` has no `Notification.permission` prompt card, no `pushManager.subscribe()` call, no re-subscription handling, and no settings toggle to unsubscribe. All of §Phase 2's client requirements are unbuilt.
- **No `api/push/dispatch.js`** for the Supabase Database Webhook-triggered push path.
- **404/410 pruning exists** in `push-routes.js`'s admin send path, but keyed on `user_id` deletion (deletes ALL of a user's subscriptions on one dead endpoint) rather than deleting just the dead endpoint row: another symptom of the wrong table shape.

Web Push is a substantial rebuild in Phase 2, not a light touch-up.

---

## 11. crew-framework.js Audit (client-side hardening)

Direct code read confirms:

1. **Session-expiry handler is NOT fixed.** `_initErrorHandler()` still does `msg.includes('JWT') || msg.includes('session') || msg.includes('auth')` substring matching on any unhandled rejection, exactly the bug Phase 2 must fix (replace with `error.status === 401` / specific Supabase error codes).
2. **SW update banner is NOT fixed.** `registerSW()` still listens for a `postMessage({type:'SW_UPDATED'})` broadcast from the service worker's `activate` handler, which fires on first-ever install too (showing "new version available" to brand-new users). `sw.js`'s `activate` listener still does exactly that broadcast. Phase 2 must move detection to `registration.onupdatefound` + `installing.onstatechange` checking `navigator.serviceWorker.controller` already exists.
3. **Role-guard parity bug confirmed.** In production code paths, both the top-level `requireAuth()` (line ~122) and `crewAuth.require()` (line ~653) only bypass the role check for `role === 'admin'`: **`crewbase_admin` is NOT included**, even though the demo-mode code paths (lines ~95, ~624) do bypass for both `admin` and `crewbase_admin`. This is a genuine prod/demo behavioural mismatch that Phase 2 must fix with one shared `isPrivileged(role)` helper.
4. **No missing-profile retry logic.** `getProfile()` returns `null` on any error or empty result with no retry; there is no 3-attempt/~3-second retry loop to cover the `handle_new_user` trigger race on first OAuth sign-in, and no friendly toast + redirect-to-login fallback.
5. **No Realtime hygiene.** The notifications channel (`_subscribeNotifications`) is never unsubscribed on `pagehide`, and the mark-read writes (`db.from('notifications').update(...)`) have no retry-with-backoff on failure.
6. Toast, offline banner, install prompt (`beforeinstallprompt` + `#crew-install-btn`), and `CrewFramework.*` / `crewAuth.*` / `crewUI.*` public API shims are all present and functioning as documented: **no changes needed to those.**

`crew-ai.js` (client) and the server's `/api/ai` handler: server-side auth is already correctly enforced (`requireUser` + `aiLimiter` in server.js): this was an open item in the previous audit and is now genuinely fixed. **However**, neither the client fetch in `crew-ai.js` nor the server's fetch to Ollama wraps the call in an `AbortController` timeout: a hung Ollama instance would hang the request indefinitely. Phase 2 open item.

---

## 12. CSP Note

`server.js`'s helmet CSP already includes `'unsafe-inline'` for `script-src` (unavoidable: the monolith HTML files rely on inline `<script>` blocks throughout; rewriting them all to external files or adding per-request nonces is out of scope for this codebase's architecture and would require the module rewrite this project explicitly avoids). `base-uri 'self'` is **not yet present**: Phase 2 open item. Adding it closes the main gap `unsafe-inline` otherwise leaves open (an injected `<base>` tag redirecting all relative URLs), without requiring the inline-script rewrite.

---

## 13. Copy Audit (Australian English + AI-tell sweep): rewritten after manual verification

The first pass of this audit used a blind word-list regex and reported 535 "AI-tell" hits and 92 "US spelling" hits. On manual inspection of the actual surrounding code, the overwhelming majority were false positives:

- `elevat*` and `unlock*` matches were almost entirely CSS custom properties (`var(--elevated)`, `--elevated:`) or literal, correct English usage with no marketing connotation ("gate unlocked", the "Explorer Unlock" gamification achievement screen, "elevated work" as the genuine OHS/construction term for working at height). None of these are the AI-tell pattern the ground rule targets.
- A direct search for the five highest-confidence AI-tell words (`delve`, `seamless`, `leverage`, `empower`, `supercharge`) across every HTML file in the repo returns zero hits. The earlier session's language sweep had already removed all of these.
- `behavior` hits were the CSS property `scroll-behavior` and the Web Animations API property `{behavior:'smooth'}`, both spec-mandated identifiers, correctly left unchanged per the ground rule's exception.
- `optimize`/`favorite`/`neighborhood` matches were mostly CSS class names (`.route-optimize-btn`, `.favorite-contractor-card`, `.neighborhood-card`), author-chosen code identifiers rather than spec keys, but renaming them risks breaking `querySelector`/`classList` references scattered through multi-megabyte files for zero user-visible benefit. Left unchanged, consistent with the ground rule's treatment of code identifiers.

Real prose hits found by reading context, fixed in this pass, and verified by grep:
- "Favorite Contractors" heading, "Customize your experience", "Optimize for screen readers" labels, and a "Neighborhood recommendations" code comment (Crew_App_Customer_Role.html, Crew_App_Crew_Manager.html, Crew_App_Crew_Member.html)
- "Command Center is optimized for desktop and tablet viewing", "Tablet optimizations"/"Desktop optimizations" code comments, "AI-Powered Scheduling Optimization" and "Optimization Suggestion" labels (Command_Center_Desktop.html, Command_Center_Tablet.html, CrewBase_Dashboard.html)

27 real fixes applied and verified. No further AI-tell or US-spelling action items remain open after this pass.

**Em dash / en dash (U+2014/U+2013):** all instances found and fixed in this pass, including the offline banner string in `crew-framework.js` (`_initOfflineIndicator`, was `'You're offline: some features...'`), 404.html/offline.html titles and privacy-notice comments, the SOS button comment/aria-label and star-rating comment in the three main apps and CrewBase_Field_Worker_App.html, SETUP_GUIDE.md, and documentation/SUPABASE_SETUP.html. A final repo-wide grep for the character class across every `.html`/`.md` file returns zero hits except CLAUDE.md's single occurrence, which is the project instruction file itself quoting this exact character as a rule example, not user-facing or generated copy, left untouched as out of scope for this run.

---

## 13a. Critical finding during Phase 1: broken inline JavaScript (not in the original scope, fixed anyway)

While fixing the offline-banner em dash, editing it introduced a string-termination syntax error, which prompted checking whether the *original* string had the same latent problem elsewhere. It did, extensively. A full scanner was built to extract every inline `<script>` block from every HTML file and run `node --check` on it. This found that **several large, genuinely load-bearing script blocks were silently broken by JS syntax errors already present in the codebase**, unrelated to anything in the original Phase 0 to 9 plan, but squarely "provably broken functionality" that a hardening pass should not leave in place:

- **Crew_App_Customer_Role.html**: a 1,245-line script block (core customer-app logic) failed to parse at all due to an unescaped apostrophe in a `crewUI.toast('...You're offline...')` call. In a real browser this means **the entire block silently never executes**: no syntax error is shown to the user, the block just does nothing.
- **Crew_App_Crew_Member.html and Crew_App_Customer_Role.html** (both apps share the equipment-rental and handyman-booking code): eleven separate instances of the same authoring bug: HTML-string-building code writing `onclick="someFunction('' + id + '')"` where a literal quote character needed in the output attribute was written as a bare `'` instead of an escaped `\'`, terminating the enclosing JS string early. This broke: rental category switching (`rcSetCat`, `rcSetSub`), rental item detail/reserve (`rcDetail`, `rcReserve`), handyman zone photo capture (`hwCapture`, `hwNote`), the "no equipment in this area" empty-state link, and the chat-room list-item click handler.
- **CrewBase_Dashboard.html**: the same bug in the admin "Assign" button on the work-request/report list (`assignReport`).
- **CrewBase_Field_Worker_App.html**: the same bug in the work-order detail click handler (`openWorkOrderDetail`).
- **Crew_App_Crew_Member.html**: a malformed multi-line string where a `<link rel="stylesheet" href="/accessibility.css">` tag had been inserted into a print-certificate HTML template with a raw, unescaped line break in the middle of a single-quoted JS string (likely from an earlier accessibility-CSS rollout script that edited this line carelessly). Duplicated identically in Crew_App_Customer_Role.html.
- **Command_Center_Desktop.html**: a malformed `</script<script>` tag boundary (missing `>` and no whitespace) between two script blocks, which would either fail to close the first script properly or cause the parser to swallow content unpredictably depending on the browser.
- **downloads.html**: a stray empty `<script>` tag immediately preceding `<script src="/back-to-top.js" defer></script>`, which causes the browser to treat the *entire second script tag* as inert text content of the first, empty one. In practice this means **`back-to-top.js` never loads on the downloads page**: the only one of the 15 marketing pages with this bug (the other 14 have it correctly).

All of the above are fixed and independently re-verified: every inline `<script>` block across every `.html` file in the repository (including `documentation/`) now passes `node --check` with zero errors, and every standalone `.js` file does too.

This is exactly the class of defect the large-file editing strategy warns about: these bugs were almost certainly introduced by an earlier automated find-and-replace or code-generation pass that didn't account for quote-escaping inside string-built HTML, and they were completely invisible without actually parsing the extracted script content, since browsers fail silently on this rather than showing a visible error to the end user.

---

## 14. vercel.json Issues (carried for Phase 8, noted now for completeness)

Duplicate `.webp` header block; duplicate HSTS header on the catch-all rule; no CSP on API routes; deprecated `X-XSS-Protection` header; missing rewrites for `/apps`, `/complaints`, `/reset-password`, `/auth/callback`; Zai/Assembly CSP domains still present. All addressed in Phase 8/6.

---

## 15. TWA / Android Build Status

Unchanged from the previous audit: all 5 TWA manifests exist in `twa/`, `.well-known/assetlinks.json` exists, keystore lives in GitHub Secrets (`CREW_KEYSTORE_BASE64`, not touched by this run per the ground rules), `.github/workflows/build-apks.yml` covers all 5 apps. Not modified in this phase; icon sources updated in Phase 4 without running CI.

---

## 16. Phase-by-Phase Action Summary (updated against real current state)

| Phase | Confirmed already done | Still to do |
|---|---|---|
| 1 | 404.html/offline.html branded; most em-dash/AU-English sweep on 3 main apps; lang="en-AU" on auth.html; server.js clean routes already complete | Remove dead script tags (crew-demo-data.js, crew-integration-e2e.js) and cdn-cgi artifact; delete orphan scripts; finish AI-tell/US-spelling/em-dash sweep on Command Center + CrewBase_Dashboard + remainder; fix offline banner em dash; Tree Lopping category; SOS button; star ratings; ARIA |
| 2 | Escrow CAS (genuinely solid); `/api/ai` server-side auth; rate limiter scoped to `/api/*`; `lib/require-user.js` real and correct; SW bumped to crew-v4 | Per-file SW shell caching; SW update-banner timing fix (client + SW); session-expiry handler (real Supabase error codes, not substring match); role-guard parity (`isPrivileged` helper); missing-profile retry; image cache LRU; crew-ai.js/server AbortController timeout; Realtime hygiene; CSP `base-uri 'self'`; full rebuild of `lib/notify.js` to the real `notify(userId, {...})` contract; fix `push_subscriptions` to one-row-per-endpoint; client-side push subscribe flow + settings toggle; `api/push/dispatch.js`; widen dispute endpoint to party-scoped |
| 3 | Google OAuth button exists in auth.html (needs verification) | Delete all 108 OTP + 14 magic-link + 33 biometric occurrences from auth.html; add Apple OAuth behind flag; build auth/callback.html, reset-password.html; AUTH_SETUP.md |
| 4 | none | Everything (no per-role manifests, no apps.html, no complaints.html, no icon pipeline, no legal-page footer links, no SEO tags) |
| 5 | none | Everything (no migrations directory beyond CLI temp files) |
| 6 | none | Everything (Zai fully intact, zero CheckVault code) |
| 7 | none | Everything |
| 8 | none | Everything |
| 9 | none | Everything |

---

*This audit is a point-in-time snapshot taken before any Phase 1+ fixes in this run. Decisions made while acting on these findings are recorded in DECISIONS.md at the repo root.*
