-- ─────────────────────────────────────────────────────────────────────────────
-- 0003_phase7.sql
-- Phase 7 additions: credential verification workflow columns, admin metrics
-- view for the quotes/recurring-bookings features. Idempotent: safe to run
-- more than once.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.contractor_credentials
  ADD COLUMN IF NOT EXISTS verified_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_reason  TEXT;

-- One credential row per (profile, kind): re-submitting a licence replaces
-- the pending row rather than creating a duplicate.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contractor_credentials_profile_kind_key'
  ) THEN
    ALTER TABLE public.contractor_credentials
      ADD CONSTRAINT contractor_credentials_profile_kind_key UNIQUE (profile_id, kind);
  END IF;
END $$;

-- Recurring bookings: track how many occurrences remain to be spawned, and
-- when the next one is due, on the parent (template) booking only.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS recurrence_remaining  INT,
  ADD COLUMN IF NOT EXISTS recurrence_next_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS bookings_recurrence_next_idx
  ON public.bookings(recurrence_next_at) WHERE recurrence_rule IS NOT NULL;
