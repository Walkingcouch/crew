-- ─────────────────────────────────────────────────────────────────
-- Phase 2: CrewBase Real Data Schema
-- Run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- ── 1. Organisations (councils/companies using CrewBase)
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

-- ── 2. Organisation members (who belongs to which org)
CREATE TABLE IF NOT EXISTS public.org_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member'
                    CHECK (role IN ('owner','admin','supervisor','field_worker','viewer')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- ── 3. Community reports (public submissions)
-- Drop and recreate with new columns
ALTER TABLE public.community_reports 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_worker_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' 
    CHECK (priority IN ('low','medium','high','critical')),
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 4. Work orders (assigned jobs from reports)
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

-- Auto-update updated_at
DROP TRIGGER IF EXISTS work_orders_updated_at ON public.work_orders;
CREATE TRIGGER work_orders_updated_at
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 5. Field worker check-ins
CREATE TABLE IF NOT EXISTS public.checkins (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  org_id       UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('clock_in','clock_out','on_site','off_site')),
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 6. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT,
  type         TEXT DEFAULT 'info' CHECK (type IN ('info','success','warning','alert')),
  read         BOOLEAN DEFAULT FALSE,
  link         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 7. Row Level Security

-- Organisations: members can see their org
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view their org" ON public.organisations;
CREATE POLICY "Members can view their org"
  ON public.organisations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = id AND m.user_id = auth.uid()
  ));

-- Org members
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view their org members" ON public.org_members;
CREATE POLICY "Members can view their org members"
  ON public.org_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = org_id AND m.user_id = auth.uid()
  ));

-- Work orders: org members can see their org's orders
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can view work orders" ON public.work_orders;
CREATE POLICY "Org members can view work orders"
  ON public.work_orders FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = org_id AND m.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Field workers can update their orders" ON public.work_orders;
CREATE POLICY "Field workers can update their orders"
  ON public.work_orders FOR UPDATE
  USING (assigned_to = auth.uid() OR EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = org_id AND m.user_id = auth.uid()
    AND m.role IN ('owner','admin','supervisor')
  ));

DROP POLICY IF EXISTS "Supervisors can insert work orders" ON public.work_orders;
CREATE POLICY "Supervisors can insert work orders"
  ON public.work_orders FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = org_id AND m.user_id = auth.uid()
    AND m.role IN ('owner','admin','supervisor')
  ));

-- Checkins
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workers can manage their checkins" ON public.checkins;
CREATE POLICY "Workers can manage their checkins"
  ON public.checkins FOR ALL
  USING (worker_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = org_id AND m.user_id = auth.uid()
    AND m.role IN ('owner','admin','supervisor')
  ));

-- Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
CREATE POLICY "Users see own notifications"
  ON public.notifications FOR ALL
  USING (user_id = auth.uid());

-- ── 8. Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_user    ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org     ON public.org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_org     ON public.work_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_worker  ON public.work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_orders_status  ON public.work_orders(status);
CREATE INDEX IF NOT EXISTS idx_checkins_worker     ON public.checkins(worker_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user  ON public.notifications(user_id, read);

-- ── 9. Demo org for testing
INSERT INTO public.organisations (name, slug, email, plan)
VALUES ('Crew Demo Organisation', 'crew-demo', 'demo@getcrew.au', 'pro')
ON CONFLICT (slug) DO NOTHING;
