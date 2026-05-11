-- ============================================================
-- Crew Desktop App — Download Infrastructure Schema
-- Run this in the Supabase SQL Editor (Settings → SQL Editor)
-- ============================================================

-- ── 1. Storage Bucket ─────────────────────────────────────────
-- Option A (recommended): create via Supabase Dashboard
--   Storage → New bucket → Name: "downloads" → Public: ON → Save
--
-- Option B: create via Supabase CLI
--   supabase storage create-bucket downloads --public
--
-- Option C: SQL (only works if your Supabase version supports it)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'downloads',
  'downloads',
  true,
  524288000,  -- 500 MB max per file
  ARRAY[
    'application/x-msdownload',        -- .msi / .exe
    'application/octet-stream',        -- generic binary
    'application/x-apple-diskimage',   -- .dmg
    'application/zip',                 -- .zip
    'application/x-zip-compressed'    -- .zip (alt MIME)
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Public read policy for the downloads bucket
CREATE POLICY "Public downloads read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'downloads');

-- ── 2. Download Counts Table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS download_counts (
  id           SERIAL PRIMARY KEY,
  platform     TEXT NOT NULL,                        -- 'windows' | 'windows-zip' | 'macos'
  app_name     TEXT NOT NULL DEFAULT 'crew-desktop',
  count        INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(platform, app_name)
);

-- Seed initial rows so the counter exists before any download
INSERT INTO download_counts (platform, app_name, count)
VALUES
  ('windows',     'crew-desktop', 0),
  ('windows-zip', 'crew-desktop', 0),
  ('macos',       'crew-desktop', 0)
ON CONFLICT (platform, app_name) DO NOTHING;

-- Allow anonymous reads (so the page can display total counts)
ALTER TABLE download_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public download counts read"
  ON download_counts FOR SELECT
  USING (true);

-- Anon can only increment via the RPC function, not direct UPDATE
-- (SECURITY DEFINER on the function below bypasses RLS for writes)

-- ── 3. Increment RPC Function ─────────────────────────────────
CREATE OR REPLACE FUNCTION increment_download_count(
  p_platform  TEXT,
  p_app_name  TEXT DEFAULT 'crew-desktop'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER        -- runs as the function owner, bypassing RLS
SET search_path = public
AS $$
BEGIN
  INSERT INTO download_counts (platform, app_name, count)
  VALUES (p_platform, p_app_name, 1)
  ON CONFLICT (platform, app_name) DO UPDATE
    SET count        = download_counts.count + 1,
        last_updated = now();
END;
$$;

-- Grant execution to the anon role (public website visitors)
GRANT EXECUTE ON FUNCTION increment_download_count(TEXT, TEXT) TO anon;

-- ── 4. File Upload Instructions ───────────────────────────────
-- After running this SQL:
--   1. Go to Supabase Dashboard → Storage → downloads bucket
--   2. Upload the following files:
--        crew-desktop-windows-setup.msi   (Windows installer)
--        crew-desktop-windows.zip         (Windows portable .zip)
--        crew-desktop-macos.dmg           (macOS disk image)
--   3. Public URLs will be:
--        https://ggocdbsspynihtqlgozv.supabase.co/storage/v1/object/public/downloads/crew-desktop-windows-setup.msi
--        https://ggocdbsspynihtqlgozv.supabase.co/storage/v1/object/public/downloads/crew-desktop-windows.zip
--        https://ggocdbsspynihtqlgozv.supabase.co/storage/v1/object/public/downloads/crew-desktop-macos.dmg
