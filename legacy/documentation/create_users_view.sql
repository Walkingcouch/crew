-- ═══════════════════════════════════════════════════════════════════════════
-- CREW PLATFORM — CREATE USERS VIEW
-- create_users_view.sql
--
-- Run this in Supabase SQL Editor.
-- Works with your CURRENT profiles table (no full_name column yet).
-- Step 1: Check what columns you actually have, then create the view safely.
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: First run this to see your actual columns:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'profiles'
-- ORDER BY ordinal_position;

-- STEP 2: Add the missing columns to profiles first
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name       text,
  ADD COLUMN IF NOT EXISTS name            text,
  ADD COLUMN IF NOT EXISTS avatar_initials text,
  ADD COLUMN IF NOT EXISTS avatar_url      text,
  ADD COLUMN IF NOT EXISTS company_name    text,
  ADD COLUMN IF NOT EXISTS bio             text,
  ADD COLUMN IF NOT EXISTS org_id          uuid;

-- STEP 3: Backfill name from email if empty
UPDATE public.profiles
SET
  name            = COALESCE(name, split_part(email, '@', 1)),
  full_name       = COALESCE(full_name, name, split_part(email, '@', 1)),
  avatar_initials = COALESCE(avatar_initials, UPPER(LEFT(COALESCE(name, email, 'U'), 1)))
WHERE name IS NULL OR full_name IS NULL;

-- STEP 4: Now create the view safely
DROP VIEW IF EXISTS public.users;

CREATE VIEW public.users AS
SELECT
  id,
  email,
  COALESCE(name, full_name, split_part(email,'@',1)) AS name,
  COALESCE(full_name, name, split_part(email,'@',1)) AS full_name,
  role,
  phone,
  phone AS phone_number,
  company_name,
  avatar_url,
  COALESCE(avatar_initials, UPPER(LEFT(COALESCE(name, email,'U'),1))) AS avatar_initials,
  org_id,
  bio
FROM public.profiles;

-- STEP 5: Trigger to keep name + full_name + initials in sync
CREATE OR REPLACE FUNCTION public.sync_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync name ↔ full_name
  IF NEW.full_name IS NOT NULL AND NEW.name IS NULL THEN
    NEW.name := NEW.full_name;
  END IF;
  IF NEW.name IS NOT NULL AND NEW.full_name IS NULL THEN
    NEW.full_name := NEW.name;
  END IF;
  -- Auto initials
  IF NEW.avatar_initials IS NULL OR NEW.avatar_initials = '' THEN
    NEW.avatar_initials := UPPER(LEFT(COALESCE(NEW.name, NEW.full_name, NEW.email, 'U'), 1));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_profile_fields ON public.profiles;
CREATE TRIGGER trg_sync_profile_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_fields();

-- STEP 6: Update auth trigger to capture Google OAuth name + avatar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _name text;
BEGIN
  _name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  INSERT INTO public.profiles (id, email, full_name, name, avatar_url, avatar_initials, role)
  VALUES (
    NEW.id,
    NEW.email,
    _name,
    _name,
    NEW.raw_user_meta_data->>'avatar_url',
    UPPER(LEFT(_name, 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = COALESCE(profiles.full_name, EXCLUDED.full_name),
    name       = COALESCE(profiles.name, EXCLUDED.name),
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Done ────────────────────────────────────────────────────────────────────
-- You now have:
--   public.users  →  view over profiles with all platform field names
--   Sync trigger  →  name ↔ full_name always in sync
--   Auth trigger  →  new signups auto-create profiles row (Google + email)
