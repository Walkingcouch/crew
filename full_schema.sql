-- ─────────────────────────────────────────────────────────────────────────────
-- Crew Platform — Full Supabase Schema  (schema.sql + phase2_schema.sql combined)
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════
-- PART 1 — CORE SCHEMA
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. User profiles ──────────────────────────────────────────────
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


-- ── 2. Beta allowlist ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.beta_allowlist (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  note       TEXT,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Replace placeholder emails with real ones before running
INSERT INTO public.beta_allowlist (email, note) VALUES
  ('your@email.com.au', 'Owner'),
  ('tester@example.com', 'Beta tester 1')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_beta_allowed(check_email TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.beta_allowlist
    WHERE lower(email) = lower(check_email)
  );
$$;


-- ── 3. Community reports ──────────────────────────────────────────
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

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS community_reports_updated_at ON public.community_reports;
CREATE TRIGGER community_reports_updated_at
  BEFORE UPDATE ON public.community_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ═══════════════════════════════════════════════════════════════════
-- PART 2 — CREWBASE / PHASE 2 SCHEMA
-- ═══════════════════════════════════════════════════════════════════

-- ── 4. Organisations ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organisations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  logo_url     TEXT,
  plan         TEXT NOT NULL DEFAULT 'trial'
                    CHECK (plan IN ('trial','starter','pro','enterprise')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.organisations (name, slug, email, plan)
VALUES ('Crew Demo Organisation', 'crew-demo', 'demo@getcrew.au', 'pro')
ON CONFLICT (slug) DO NOTHING;


-- ── 5. Organisation members ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member'
                    CHECK (role IN ('owner','admin','supervisor','field_worker','viewer')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);


-- ── 6. Community reports — phase 2 columns ───────────────────────
ALTER TABLE public.community_reports
  ADD COLUMN IF NOT EXISTS org_id              UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_worker_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority            TEXT DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','critical')),
  ADD COLUMN IF NOT EXISTS resolution_notes    TEXT,
  ADD COLUMN IF NOT EXISTS resolved_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL;


-- ── 7. Work orders ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.work_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref             TEXT GENERATED ALWAYS AS ('WO-' || substring(id::text, 1, 8)) STORED,
  report_id       UUID REFERENCES public.community_reports(id) ON DELETE SET NULL,
  org_id          UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  location        TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  assigned_to     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','accepted','in_progress','completed','cancelled')),
  priority        TEXT NOT NULL DEFAULT 'medium'
                       CHECK (priority IN ('low','medium','high','critical')),
  due_date        DATE,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  photo_urls      TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS work_orders_updated_at ON public.work_orders;
CREATE TRIGGER work_orders_updated_at
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 8. Field worker check-ins ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.checkins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  org_id        UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('clock_in','clock_out','on_site','off_site')),
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── 9. Notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT,
  type       TEXT DEFAULT 'info' CHECK (type IN ('info','success','warning','alert')),
  read       BOOLEAN DEFAULT FALSE,
  link       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- beta_allowlist
ALTER TABLE public.beta_allowlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can check beta list"     ON public.beta_allowlist;
DROP POLICY IF EXISTS "Only admins can modify beta list" ON public.beta_allowlist;

CREATE POLICY "Anyone can check beta list"
  ON public.beta_allowlist FOR SELECT USING (true);

CREATE POLICY "Only admins can modify beta list"
  ON public.beta_allowlist FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- community_reports
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reporters can view own reports"        ON public.community_reports;
DROP POLICY IF EXISTS "Reporters can insert reports"          ON public.community_reports;
DROP POLICY IF EXISTS "Admins and crewbase see all reports"   ON public.community_reports;

CREATE POLICY "Reporters can view own reports"
  ON public.community_reports FOR SELECT USING (reporter_id = auth.uid());

CREATE POLICY "Reporters can insert reports"
  ON public.community_reports FOR INSERT WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Admins and crewbase see all reports"
  ON public.community_reports FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
    AND p.role IN ('admin','crewbase_admin','supervisor')));

-- organisations
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their org" ON public.organisations;
CREATE POLICY "Members can view their org"
  ON public.organisations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = id AND m.user_id = auth.uid()));

-- org_members
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their org members" ON public.org_members;
CREATE POLICY "Members can view their org members"
  ON public.org_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_id AND m.user_id = auth.uid()));

-- work_orders
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view work orders"        ON public.work_orders;
DROP POLICY IF EXISTS "Field workers can update their orders"   ON public.work_orders;
DROP POLICY IF EXISTS "Supervisors can insert work orders"      ON public.work_orders;

CREATE POLICY "Org members can view work orders"
  ON public.work_orders FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_id AND m.user_id = auth.uid()));

CREATE POLICY "Field workers can update their orders"
  ON public.work_orders FOR UPDATE
  USING (assigned_to = auth.uid() OR EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin','supervisor')
  ));

CREATE POLICY "Supervisors can insert work orders"
  ON public.work_orders FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin','supervisor')
  ));

-- checkins
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers can manage their checkins" ON public.checkins;
CREATE POLICY "Workers can manage their checkins"
  ON public.checkins FOR ALL
  USING (worker_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin','supervisor')
  ));

-- notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
CREATE POLICY "Users see own notifications"
  ON public.notifications FOR ALL USING (user_id = auth.uid());


-- ═══════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_profiles_role        ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_beta_email           ON public.beta_allowlist(lower(email));
CREATE INDEX IF NOT EXISTS idx_reports_status       ON public.community_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter     ON public.community_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_org          ON public.community_reports(org_slug);
CREATE INDEX IF NOT EXISTS idx_reports_created      ON public.community_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_members_user     ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org      ON public.org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_org      ON public.work_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_worker   ON public.work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_orders_status   ON public.work_orders(status);
CREATE INDEX IF NOT EXISTS idx_checkins_worker      ON public.checkins(worker_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON public.notifications(user_id, read);
