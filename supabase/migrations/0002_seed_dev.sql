-- ═══════════════════════════════════════════════════════════════════════════
-- [DEMO] Crew Platform: dev-only seed data
-- Safe to run against a development/staging project only. Never run this
-- against production. Idempotent (ON CONFLICT DO NOTHING throughout).
--
-- Note: profiles, bookings, quotes etc. all reference real auth.users rows,
-- which can only be created through an actual sign-up (Google/Apple/email),
-- not a plain INSERT (Supabase Auth manages its own internal columns on
-- auth.users). This seed therefore covers the data that does NOT depend on
-- a real authenticated user existing yet: the beta allowlist and a demo
-- organisation. After signing up for real in a dev project, promote your
-- own account with the UPDATE at the bottom of this file.
-- ═══════════════════════════════════════════════════════════════════════════

-- [DEMO] Add your own email so you can sign in during BETA_MODE=true testing.
INSERT INTO public.beta_allowlist (email, note) VALUES
  ('owner@example.com.au', '[DEMO] Replace with your real email before testing beta gating')
ON CONFLICT (email) DO NOTHING;

-- [DEMO] A sample organisation for CrewBase/enterprise testing.
INSERT INTO public.organisations (name, slug, email, plan, abn, kyb_status, commission_tier)
VALUES ('Crew Demo Organisation', 'crew-demo', 'demo@getcrew.com.au', 'pro', '12 345 678 901', 'verified', 'standard')
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- [DEMO] After you've signed up for real in this dev project, run this to
-- promote your own account to admin so you can see the Command Centre and
-- the admin metrics views. Replace the email first.
-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'owner@example.com.au';
