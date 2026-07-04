-- ─────────────────────────────────────────────────────────────────────────────
-- Crew Platform — Profile columns migration
-- Run in: Supabase Dashboard → SQL Editor → New Query
--
-- auth.html upserts `avatar_initials` and `org_id` on every sign-in/sign-up.
-- These columns were missing from the original schema.sql.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_initials TEXT,
  ADD COLUMN IF NOT EXISTS org_id          TEXT;

-- Update handle_new_user trigger to populate org_id on new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  INSERT INTO public.profiles (id, email, full_name, phone, role, avatar_initials, org_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    v_role,
    upper(left(COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), 1)) ||
      upper(left(split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 2), 1)),
    CASE WHEN v_role IN ('field_worker','supervisor','crewbase_admin')
         THEN 'a1b2c3d4-0000-0000-0000-000000000002'
         ELSE 'a1b2c3d4-0000-0000-0000-000000000001'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Notifications table (required by crew-framework.js notification bell)
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT,
  type       TEXT DEFAULT 'info' CHECK (type IN ('info','warning','alert','success')),
  link       TEXT,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark own notifications read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON public.notifications(user_id, read) WHERE read = false;

-- Allow admins/managers to insert notifications for any user
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);
