-- ═══════════════════════════════════════════════════════════════════════════
-- Crew Platform: post-migration verification
-- Run after applying 0001_init.sql (and 0002_seed_dev.sql in dev only).
-- Every check should return TRUE / the expected row. Run in the Dashboard's
-- SQL Editor or via: supabase db execute -f supabase/verify.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Every expected table exists.
SELECT 'tables' AS check_name, array_agg(table_name ORDER BY table_name) AS present
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles','organisations','bookings','escrow_events','transactions',
    'webhook_events','notifications','admin_notifications','beta_allowlist',
    'community_reports','login_attempts','rate_limits','push_subscriptions',
    'channels','channel_members','messages','quotes','job_photos',
    'contractor_credentials','availability','availability_exceptions',
    'service_areas','invoices'
  );

-- 2. RLS is enabled on every sensitive table.
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN (
    'profiles','organisations','bookings','escrow_events','transactions',
    'webhook_events','notifications','beta_allowlist','community_reports',
    'push_subscriptions','quotes','job_photos','contractor_credentials',
    'availability','service_areas','invoices'
  )
ORDER BY relname;
-- Expect rls_enabled = true for every row above.

-- 3. profiles.role check constraint covers every role used by the app.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass AND contype = 'c' AND conname LIKE '%role%';

-- 4. bookings.escrow_state check constraint covers all 9 states.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.bookings'::regclass AND contype = 'c' AND conname LIKE '%escrow_state%';

-- 5. is_beta_allowed RPC exists with the expected parameter name.
SELECT proname, pg_get_function_arguments(oid) AS args
FROM pg_proc WHERE proname = 'is_beta_allowed';
-- Expect args to include "p_email text".

-- 6. bump_rate_limit RPC exists.
SELECT proname FROM pg_proc WHERE proname = 'bump_rate_limit';

-- 7. handle_new_user trigger is attached to auth.users.
SELECT tgname, tgrelid::regclass AS on_table
FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- 8. Column-level protection on profiles: authenticated should NOT be able
--    to update role/provider_account_id/kyc_status/paused/paused_reason.
SELECT grantee, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
ORDER BY column_name;
-- Expect this list to NOT include role, provider_account_id, kyc_status,
-- paused, paused_reason, rating_avg, rating_count.

-- 9. Quotes unique-pending-per-contractor partial index exists.
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'quotes' AND indexname = 'quotes_one_pending_per_contractor';

-- 10. Admin metrics views exist.
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public' AND table_name LIKE 'metrics_%'
ORDER BY table_name;
-- Expect: metrics_contractor_utilisation, metrics_disputes, metrics_gmv_daily,
--         metrics_take_rate, metrics_time_to_match

-- 11. Realtime publication includes notifications/bookings/quotes (best-effort;
--     will show nothing if supabase_realtime publication doesn't exist yet,
--     in which case enable Realtime for these tables via the Dashboard).
SELECT schemaname, tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename IN ('notifications','bookings','quotes');
