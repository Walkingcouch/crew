-- ─────────────────────────────────────────────────────────────────
-- Crew Platform — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────


-- ── 1. User profiles ───────────────────────────────────────────────
-- Extends auth.users with role, name, phone
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

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 2. Beta allowlist ──────────────────────────────────────────────
-- Only emails in this table can complete sign-in during beta
CREATE TABLE IF NOT EXISTS public.beta_allowlist (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  note       TEXT,                     -- e.g. "founder", "council tester"
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert your own email(s) here — edit as needed
INSERT INTO public.beta_allowlist (email, note) VALUES
  ('your@email.com.au',      'Owner'),
  ('tester@example.com',     'Beta tester 1')
ON CONFLICT (email) DO NOTHING;

-- Function called by auth.html after OTP verify to gate access
CREATE OR REPLACE FUNCTION public.is_beta_allowed(check_email TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.beta_allowlist
    WHERE lower(email) = lower(check_email)
  );
$$;


-- ── 3. Community reports ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref           TEXT GENERATED ALWAYS AS ('CR-' || substring(id::text, 1, 8)) STORED,
  reporter_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issue_type    TEXT NOT NULL,
  description   TEXT,
  location      TEXT NOT NULL,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  severity      TEXT NOT NULL DEFAULT 'Medium'
                     CHECK (severity IN ('Low','Medium','High','Critical')),
  photo_url     TEXT,
  status        TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','assigned','in_progress','resolved','closed')),
  org_slug      TEXT,
  org_name      TEXT,
  org_email     TEXT,
  assigned_to   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS community_reports_updated_at ON public.community_reports;
CREATE TRIGGER community_reports_updated_at
  BEFORE UPDATE ON public.community_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Webhook → Edge Function: fires when a new report is inserted
-- (Configure in Supabase Dashboard → Database → Webhooks)
-- Table: community_reports, Event: INSERT
-- URL: https://<project>.supabase.co/functions/v1/send-report-email


-- ── 4. Row Level Security ──────────────────────────────────────────

-- profiles: users can read/update their own
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- beta_allowlist: public read (needed for client-side check), admin write
ALTER TABLE public.beta_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can check beta list"
  ON public.beta_allowlist FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify beta list"
  ON public.beta_allowlist FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- community_reports: reporters see their own; admins/crewbase see all
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters can view own reports"
  ON public.community_reports FOR SELECT
  USING (reporter_id = auth.uid());

CREATE POLICY "Reporters can insert reports"
  ON public.community_reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Admins and crewbase see all reports"
  ON public.community_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'crewbase_admin', 'supervisor')
    )
  );


-- ── 5. Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_role        ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_beta_email           ON public.beta_allowlist(lower(email));
CREATE INDEX IF NOT EXISTS idx_reports_status       ON public.community_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter     ON public.community_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_org          ON public.community_reports(org_slug);
CREATE INDEX IF NOT EXISTS idx_reports_created      ON public.community_reports(created_at DESC);
