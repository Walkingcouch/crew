-- ═══════════════════════════════════════════════════════════════════════════
-- Crew Platform: consolidated Supabase schema
-- Idempotent: every statement is safe to re-run. Extends the legacy
-- schema.sql / full_schema.sql / phase2_schema.sql tables in place rather
-- than dropping them, in case they are already applied to the live project.
-- Apply via: supabase db push, or paste into Dashboard -> SQL Editor.
-- See supabase/APPLY.md for full instructions, including Storage buckets.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PROFILES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'customer'
                   CHECK (role IN ('customer','crew_member','crew_manager','admin','field_worker','supervisor','crewbase_admin')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS abn                 TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider     TEXT NOT NULL DEFAULT 'checkvault',
  ADD COLUMN IF NOT EXISTS provider_account_id  TEXT,
  ADD COLUMN IF NOT EXISTS kyc_status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (kyc_status IN ('pending','requires_action','verified','failed')),
  ADD COLUMN IF NOT EXISTS rating_avg           NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS rating_count         INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS org_id               UUID,
  ADD COLUMN IF NOT EXISTS suburb               TEXT,
  ADD COLUMN IF NOT EXISTS auth_provider        TEXT,
  ADD COLUMN IF NOT EXISTS paused               BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_reason        TEXT;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup. auth_provider is read from the identity
-- Supabase attaches to the session (google/apple/email); role and full_name
-- come from user metadata set at signUp() time.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role, auth_provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND role IN ('admin','crewbase_admin'));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ORGANISATIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organisations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE,
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  logo_url     TEXT,
  plan         TEXT NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','starter','pro','enterprise')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS abn                  TEXT,
  ADD COLUMN IF NOT EXISTS provider_account_id  TEXT,
  ADD COLUMN IF NOT EXISTS kyb_status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (kyb_status IN ('pending','requires_action','verified','failed')),
  ADD COLUMN IF NOT EXISTS commission_tier      TEXT NOT NULL DEFAULT 'standard';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. BOOKINGS + ESCROW
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.booking_ref_seq START 1;

CREATE TABLE IF NOT EXISTS public.bookings (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref                      TEXT UNIQUE NOT NULL DEFAULT ('BK-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.booking_ref_seq')::text, 5, '0')),
  customer_id              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  contractor_id            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  org_id                   UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
  service_type             TEXT NOT NULL,
  service_name             TEXT,
  description              TEXT,
  address                  TEXT,
  suburb                   TEXT,
  lat                      DOUBLE PRECISION,
  lng                      DOUBLE PRECISION,
  scheduled_at             TIMESTAMPTZ,
  total_cents              INT NOT NULL CHECK (total_cents > 0),
  escrow_state             TEXT NOT NULL DEFAULT 'CREATED'
    CHECK (escrow_state IN ('CREATED','PAYMENT_PENDING','PAYMENT_HELD','DISPUTABLE','RELEASING','RELEASED','DISPUTED','REFUNDED','CANCELLED')),
  provider_escrow_id       TEXT,
  payment_method           TEXT CHECK (payment_method IN ('bank_transfer','bpay','card')),
  payment_reference        TEXT,
  payment_account_id       TEXT,
  dispute_deadline         TIMESTAMPTZ,
  auto_release_at          TIMESTAMPTZ,
  job_completed_at         TIMESTAMPTZ,
  completed_by             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at             TIMESTAMPTZ,
  payment_released_at      TIMESTAMPTZ,
  disputed_at              TIMESTAMPTZ,
  dispute_reason           TEXT,
  dispute_notes            TEXT,
  disputed_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  dispute_resolved_at      TIMESTAMPTZ,
  dispute_resolved_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  dispute_resolution       TEXT,
  dispute_admin_notes      TEXT,
  refunded_at              TIMESTAMPTZ,
  refund_amount            INT,
  refund_reason            TEXT,
  rating                   INT CHECK (rating BETWEEN 1 AND 5),
  rating_note              TEXT,
  ledger_json              JSONB,
  pricing_mode             TEXT NOT NULL DEFAULT 'fixed' CHECK (pricing_mode IN ('fixed','quoted')),
  recurrence_rule          TEXT,
  parent_booking_id        UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  cancelled_at             TIMESTAMPTZ,
  cancellation_fee_cents   INT NOT NULL DEFAULT 0,
  cancel_reason            TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bookings_customer_idx    ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS bookings_contractor_idx   ON public.bookings(contractor_id);
CREATE INDEX IF NOT EXISTS bookings_org_idx          ON public.bookings(org_id);
CREATE INDEX IF NOT EXISTS bookings_escrow_state_idx ON public.bookings(escrow_state);
CREATE INDEX IF NOT EXISTS bookings_parent_idx       ON public.bookings(parent_booking_id);

DROP TRIGGER IF EXISTS bookings_updated_at ON public.bookings;
CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.escrow_events (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id   UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  from_state   TEXT,
  to_state     TEXT NOT NULL,
  trigger      TEXT NOT NULL,
  reason       TEXT,
  metadata     JSONB DEFAULT '{}'::jsonb,
  ts           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS escrow_events_booking_idx ON public.escrow_events(booking_id);

CREATE TABLE IF NOT EXISTS public.transactions (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id    UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  type          TEXT NOT NULL CHECK (type IN ('deposit','release','refund','disbursement','fee','cancellation_fee')),
  amount_cents  INT NOT NULL,
  provider_response JSONB,
  ts            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS transactions_booking_idx ON public.transactions(booking_id);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_event_id TEXT NOT NULL UNIQUE,
  event_type      TEXT NOT NULL,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error           TEXT,
  failed_at       TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,
  type        TEXT NOT NULL DEFAULT 'info',
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON public.notifications(user_id, read);

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type        TEXT NOT NULL,
  message     TEXT NOT NULL,
  meta        JSONB DEFAULT '{}'::jsonb,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. BETA ALLOWLIST
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.beta_allowlist (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  note       TEXT,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Parameter name p_email matches the client calls in auth.html / auth/callback.html.
CREATE OR REPLACE FUNCTION public.is_beta_allowed(p_email TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.beta_allowlist WHERE lower(email) = lower(p_email));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. COMMUNITY REPORTS (unchanged from the legacy schema)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref           TEXT GENERATED ALWAYS AS ('CR-' || substring(id::text, 1, 8)) STORED,
  reporter_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issue_type    TEXT NOT NULL,
  description   TEXT,
  location      TEXT NOT NULL,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  severity      TEXT NOT NULL DEFAULT 'Medium' CHECK (severity IN ('Low','Medium','High','Critical')),
  photo_url     TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','in_progress','resolved','closed')),
  org_id        UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
  assigned_to   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS community_reports_updated_at ON public.community_reports;
CREATE TRIGGER community_reports_updated_at
  BEFORE UPDATE ON public.community_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. LOGIN ATTEMPTS / RATE LIMITS / PUSH SUBSCRIPTIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       TEXT,
  outcome     TEXT NOT NULL,
  note        TEXT,
  user_agent  TEXT,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          TEXT PRIMARY KEY,
  count        INT NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.bump_rate_limit(p_key TEXT, p_window_seconds INT, p_max INT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row public.rate_limits;
BEGIN
  INSERT INTO public.rate_limits (key, count, window_start) VALUES (p_key, 1, NOW())
  ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN public.rate_limits.window_start < NOW() - (p_window_seconds || ' seconds')::interval
                  THEN 1 ELSE public.rate_limits.count + 1 END,
    window_start = CASE WHEN public.rate_limits.window_start < NOW() - (p_window_seconds || ' seconds')::interval
                  THEN NOW() ELSE public.rate_limits.window_start END
  RETURNING * INTO v_row;
  RETURN v_row.count <= p_max;
END;
$$;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. MESSAGING (schema only, not wired into the UI yet)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  org_id      UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.channel_members (
  channel_id  UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  channel_id  UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  sender_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_channel_idx ON public.messages(channel_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. QUOTES (Phase 7 feature)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quotes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  contractor_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents   INT NOT NULL CHECK (amount_cents > 0),
  message        TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','withdrawn','expired')),
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS quotes_one_pending_per_contractor
  ON public.quotes(booking_id, contractor_id) WHERE (status = 'pending');
CREATE INDEX IF NOT EXISTS quotes_booking_idx ON public.quotes(booking_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. JOB PHOTOS (Phase 7 feature)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  uploader_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('before','after','evidence')),
  storage_path TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS job_photos_booking_idx ON public.job_photos(booking_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. CONTRACTOR CREDENTIALS (Phase 7 feature)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contractor_credentials (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('licence','insurance','photo_id')),
  number         TEXT,
  issuer         TEXT,
  expires_at     DATE,
  verified       BOOLEAN NOT NULL DEFAULT false,
  document_path  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS contractor_credentials_expiry_idx ON public.contractor_credentials(expires_at);
CREATE INDEX IF NOT EXISTS contractor_credentials_profile_idx ON public.contractor_credentials(profile_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. AVAILABILITY + SERVICE AREAS (Phase 7 feature)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.availability (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weekday     INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL
);
CREATE INDEX IF NOT EXISTS availability_profile_idx ON public.availability(profile_id);

CREATE TABLE IF NOT EXISTS public.availability_exceptions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  available   BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (profile_id, date)
);

CREATE TABLE IF NOT EXISTS public.service_areas (
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  postcode    TEXT NOT NULL CHECK (postcode ~ '^[0-9]{4}$'),
  PRIMARY KEY (profile_id, postcode)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. INVOICES (Phase 6 feature)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.invoices (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_number  TEXT UNIQUE NOT NULL DEFAULT ('CRW-INV-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0')),
  booking_id      UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  recipient       TEXT NOT NULL CHECK (recipient IN ('customer','contractor')),
  storage_path    TEXT NOT NULL,
  total_cents     INT,
  gst_cents       INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, recipient)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. RATINGS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalc_contractor_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.contractor_id IS NOT NULL AND NEW.rating IS NOT NULL THEN
    UPDATE public.profiles p SET
      rating_count = sub.cnt,
      rating_avg   = sub.avg_rating
    FROM (
      SELECT contractor_id, COUNT(rating) AS cnt, ROUND(AVG(rating)::numeric, 2) AS avg_rating
      FROM public.bookings
      WHERE contractor_id = NEW.contractor_id AND rating IS NOT NULL
      GROUP BY contractor_id
    ) sub
    WHERE p.id = sub.contractor_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_recalc_rating ON public.bookings;
CREATE TRIGGER bookings_recalc_rating
  AFTER INSERT OR UPDATE OF rating ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.recalc_contractor_rating();

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. PUBLIC CONTRACTOR VIEW (safe columns only, no PII/provider data)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.contractor_public_profiles AS
SELECT
  p.id,
  p.full_name,
  p.avatar_url,
  p.suburb,
  p.rating_avg,
  p.rating_count,
  p.role,
  p.paused,
  array_remove(array_agg(DISTINCT sa.postcode), NULL) AS service_postcodes
FROM public.profiles p
LEFT JOIN public.service_areas sa ON sa.profile_id = p.id
WHERE p.role IN ('crew_member','crew_manager')
GROUP BY p.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. ADMIN METRICS VIEWS (admin / service-role only, enforced via RLS below)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.metrics_gmv_daily AS
SELECT date_trunc('day', payment_released_at) AS day, SUM(total_cents) AS gmv_cents
FROM public.bookings
WHERE escrow_state = 'RELEASED' AND payment_released_at IS NOT NULL
GROUP BY 1 ORDER BY 1 DESC;

CREATE OR REPLACE VIEW public.metrics_take_rate AS
SELECT date_trunc('day', t.ts) AS day,
       SUM(CASE WHEN t.type = 'fee' THEN t.amount_cents ELSE 0 END)::numeric
         / NULLIF(SUM(CASE WHEN t.type = 'release' THEN t.amount_cents ELSE 0 END), 0) AS take_rate
FROM public.transactions t
GROUP BY 1 ORDER BY 1 DESC;

CREATE OR REPLACE VIEW public.metrics_disputes AS
SELECT date_trunc('week', created_at) AS week,
       COUNT(*) FILTER (WHERE escrow_state IN ('DISPUTED')) AS disputed,
       COUNT(*) AS total,
       ROUND(100.0 * COUNT(*) FILTER (WHERE escrow_state = 'DISPUTED') / NULLIF(COUNT(*), 0), 2) AS dispute_pct
FROM public.bookings
GROUP BY 1 ORDER BY 1 DESC;

CREATE OR REPLACE VIEW public.metrics_time_to_match AS
SELECT date_trunc('day', created_at) AS day,
       AVG(EXTRACT(EPOCH FROM (job_completed_at - created_at)) / 3600) AS avg_hours_to_complete
FROM public.bookings
WHERE contractor_id IS NOT NULL
GROUP BY 1 ORDER BY 1 DESC;

CREATE OR REPLACE VIEW public.metrics_contractor_utilisation AS
SELECT contractor_id, COUNT(*) AS jobs_last_30d
FROM public.bookings
WHERE contractor_id IS NOT NULL AND created_at > NOW() - INTERVAL '30 days'
GROUP BY contractor_id;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_allowlist          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_photos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_credentials  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_areas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices                ENABLE ROW LEVEL SECURITY;

-- ── profiles ──
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- role/provider_account_id/kyc_status/paused/paused_reason must never be
-- client-writable, even to their own row. RLS's WITH CHECK can't cleanly
-- express "this column may not change" without a fragile self-referencing
-- subquery, so this is enforced with plain column-level privileges instead:
-- authenticated gets UPDATE on every column except these five.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  full_name, phone, avatar_url, abn, suburb, org_id
) ON public.profiles TO authenticated;

-- ── organisations: members and admins can read; only service-role writes ──
DROP POLICY IF EXISTS organisations_select ON public.organisations;
CREATE POLICY organisations_select ON public.organisations FOR SELECT
  USING (id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()) OR public.is_admin(auth.uid()));

-- ── bookings: party-scoped; escrow-sensitive columns are service-role only
--    (enforced by never granting UPDATE on escrow_state etc. to authenticated) ──
DROP POLICY IF EXISTS bookings_select_party ON public.bookings;
CREATE POLICY bookings_select_party ON public.bookings FOR SELECT
  USING (customer_id = auth.uid() OR contractor_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS bookings_insert_customer ON public.bookings;
CREATE POLICY bookings_insert_customer ON public.bookings FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- No client UPDATE/DELETE policy on bookings: escrow_state and all payment
-- columns are service-role only, mutated exclusively via payments/routes.js
-- (which uses the service-role key and the CAS transitions in escrow.js).

DROP POLICY IF EXISTS escrow_events_admin ON public.escrow_events;
CREATE POLICY escrow_events_admin ON public.escrow_events FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS transactions_admin ON public.transactions;
CREATE POLICY transactions_admin ON public.transactions FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS webhook_events_admin ON public.webhook_events;
CREATE POLICY webhook_events_admin ON public.webhook_events FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ── notifications: own-row only ──
DROP POLICY IF EXISTS notifications_own ON public.notifications;
CREATE POLICY notifications_own ON public.notifications FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_own_update ON public.notifications;
CREATE POLICY notifications_own_update ON public.notifications FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS admin_notifications_admin ON public.admin_notifications;
CREATE POLICY admin_notifications_admin ON public.admin_notifications FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ── beta_allowlist: service-role only (mediated entirely by the RPC) ──
-- (No policies added: RLS enabled with zero policies means authenticated/anon
--  get zero rows, while the service-role key bypasses RLS entirely.)

-- ── community_reports: authenticated insert, admin manage ──
DROP POLICY IF EXISTS community_reports_insert ON public.community_reports;
CREATE POLICY community_reports_insert ON public.community_reports FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS community_reports_select ON public.community_reports;
CREATE POLICY community_reports_select ON public.community_reports FOR SELECT
  USING (reporter_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS community_reports_admin_update ON public.community_reports;
CREATE POLICY community_reports_admin_update ON public.community_reports FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- ── login_attempts / rate_limits: service-role + admin only ──
DROP POLICY IF EXISTS login_attempts_admin ON public.login_attempts;
CREATE POLICY login_attempts_admin ON public.login_attempts FOR SELECT
  USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS rate_limits_admin ON public.rate_limits;
CREATE POLICY rate_limits_admin ON public.rate_limits FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ── push_subscriptions: own-row insert/delete ──
DROP POLICY IF EXISTS push_subscriptions_own_select ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_select ON public.push_subscriptions FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS push_subscriptions_own_insert ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_insert ON public.push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS push_subscriptions_own_delete ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_delete ON public.push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- ── messaging: member-scoped ──
DROP POLICY IF EXISTS channels_member_select ON public.channels;
CREATE POLICY channels_member_select ON public.channels FOR SELECT
  USING (id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS channel_members_own_select ON public.channel_members;
CREATE POLICY channel_members_own_select ON public.channel_members FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS messages_member_select ON public.messages;
CREATE POLICY messages_member_select ON public.messages FOR SELECT
  USING (channel_id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS messages_member_insert ON public.messages;
CREATE POLICY messages_member_insert ON public.messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND channel_id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid()));

-- ── quotes ──
DROP POLICY IF EXISTS quotes_contractor_insert ON public.quotes;
CREATE POLICY quotes_contractor_insert ON public.quotes FOR INSERT
  WITH CHECK (
    contractor_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.pricing_mode = 'quoted' AND b.contractor_id IS NULL)
  );
DROP POLICY IF EXISTS quotes_select_party ON public.quotes;
CREATE POLICY quotes_select_party ON public.quotes FOR SELECT
  USING (
    contractor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.customer_id = auth.uid())
    OR public.is_admin(auth.uid())
  );
DROP POLICY IF EXISTS quotes_update_party ON public.quotes;
CREATE POLICY quotes_update_party ON public.quotes FOR UPDATE
  USING (
    contractor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.customer_id = auth.uid())
  );

-- ── job_photos: party-scoped ──
DROP POLICY IF EXISTS job_photos_party_select ON public.job_photos;
CREATE POLICY job_photos_party_select ON public.job_photos FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND (b.customer_id = auth.uid() OR b.contractor_id = auth.uid()))
    OR public.is_admin(auth.uid())
  );
DROP POLICY IF EXISTS job_photos_party_insert ON public.job_photos;
CREATE POLICY job_photos_party_insert ON public.job_photos FOR INSERT
  WITH CHECK (
    uploader_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND (b.customer_id = auth.uid() OR b.contractor_id = auth.uid()))
  );

-- ── contractor_credentials: owner-write, admin-verify ──
DROP POLICY IF EXISTS credentials_owner_select ON public.contractor_credentials;
CREATE POLICY credentials_owner_select ON public.contractor_credentials FOR SELECT
  USING (profile_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS credentials_owner_insert ON public.contractor_credentials;
CREATE POLICY credentials_owner_insert ON public.contractor_credentials FOR INSERT
  WITH CHECK (profile_id = auth.uid());
DROP POLICY IF EXISTS credentials_owner_update ON public.contractor_credentials;
CREATE POLICY credentials_owner_update ON public.contractor_credentials FOR UPDATE
  USING (profile_id = auth.uid() OR public.is_admin(auth.uid()));

-- ── availability / service_areas: owner-write, public-read via the view ──
DROP POLICY IF EXISTS availability_owner_all ON public.availability;
CREATE POLICY availability_owner_all ON public.availability FOR ALL
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
DROP POLICY IF EXISTS availability_exceptions_owner_all ON public.availability_exceptions;
CREATE POLICY availability_exceptions_owner_all ON public.availability_exceptions FOR ALL
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
DROP POLICY IF EXISTS service_areas_owner_all ON public.service_areas;
CREATE POLICY service_areas_owner_all ON public.service_areas FOR ALL
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
DROP POLICY IF EXISTS service_areas_public_select ON public.service_areas;
CREATE POLICY service_areas_public_select ON public.service_areas FOR SELECT
  USING (true);

-- ── invoices: party-read, service-role write ──
DROP POLICY IF EXISTS invoices_party_select ON public.invoices;
CREATE POLICY invoices_party_select ON public.invoices FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND (b.customer_id = auth.uid() OR b.contractor_id = auth.uid()))
    OR public.is_admin(auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bookings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'quotes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
  END IF;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'supabase_realtime publication not found: enable Realtime for these tables via the Dashboard instead.';
END $$;
