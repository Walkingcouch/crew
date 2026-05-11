-- ═══════════════════════════════════════════════════════════════════════════
-- CREW PLATFORM — SCHEMA BRIDGE
-- schema_bridge.sql
--
-- Run this ONCE in your Supabase SQL Editor to bridge your existing
-- `profiles` schema with the Crew Platform field names.
-- Project: ggocdbsspynihtqlgozv
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Add missing columns to profiles ────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name             text,
  ADD COLUMN IF NOT EXISTS avatar_initials  text,
  ADD COLUMN IF NOT EXISTS org_id           uuid,
  ADD COLUMN IF NOT EXISTS phone            text;   -- alias for phone_number

-- ── 2. Backfill existing rows ─────────────────────────────────────────────
UPDATE public.profiles SET
  name             = COALESCE(full_name, email),
  avatar_initials  = UPPER(LEFT(COALESCE(full_name, email, 'U'), 1)),
  phone            = phone_number
WHERE name IS NULL;

-- ── 3. Trigger: keep name + avatar_initials + phone in sync on every write ─
CREATE OR REPLACE FUNCTION public.sync_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync full_name → name
  IF NEW.full_name IS NOT NULL AND (NEW.name IS NULL OR NEW.name != NEW.full_name) THEN
    NEW.name := NEW.full_name;
  END IF;
  -- Sync phone_number → phone alias
  IF NEW.phone_number IS NOT NULL AND NEW.phone IS NULL THEN
    NEW.phone := NEW.phone_number;
  END IF;
  -- Auto-generate avatar initials
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

-- ── 4. Update the existing on_auth_user_created trigger to include new fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, name, avatar_url, avatar_initials, role
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'U'), 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger (drop and recreate to apply new function)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 5. Crew Platform role mapping ─────────────────────────────────────────
-- Ensure the demo admin user has the right role
UPDATE public.profiles
  SET role = 'admin'
  WHERE email = 'demo@crewplatform.demo';

-- ── 6. RLS — ensure existing policies cover the new columns ───────────────
-- (Your existing RLS is already correct — this just verifies it's enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read and update their own profile
DROP POLICY IF EXISTS "Users can view own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ── Done ───────────────────────────────────────────────────────────────────
-- Your profiles table now has:
--   full_name, name (synced), phone_number, phone (synced),
--   company_name, avatar_url, avatar_initials, bio, role, org_id
-- All Crew Platform JS will map correctly to these columns.
