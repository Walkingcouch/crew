# Applying the Crew database migrations

The Supabase CLI is installed in this environment but not authenticated (no stored access token), so the migrations below were written and verified for correctness but not automatically applied. Run them yourself using whichever of the two methods below suits you.

## Option A: Supabase CLI

```bash
npx supabase login
npx supabase link --project-ref ggocdbsspynihtqlgozv
npx supabase db push
```

This applies every file in `supabase/migrations/` in order (`0001_init.sql`, then `0002_seed_dev.sql` if you want the dev seed data, see the warning below).

## Option B: Dashboard SQL Editor

1. Open the [Supabase Dashboard](https://app.supabase.com) for project `ggocdbsspynihtqlgozv`.
2. Go to **SQL Editor -> New query**.
3. Paste the entire contents of `supabase/migrations/0001_init.sql` and run it.
4. If you want demo data in a development project, paste and run `supabase/migrations/0002_seed_dev.sql`. **Do not run this against production.**
5. Paste and run `supabase/verify.sql` to confirm everything applied correctly (see the expected results documented as comments in that file).

## After the migration: Storage buckets

Three Storage buckets are required and are not created by the SQL migration (Supabase Storage buckets and their policies are usually managed through the Dashboard or the Storage API, not plain SQL). Create each one under **Storage -> New bucket**:

| Bucket | Public | Purpose | Policy |
|---|---|---|---|
| `job-photos` | No | Before/after/evidence photos (`job_photos` table) | Read: parties to the booking (customer_id or contractor_id) plus admins. Write: the uploader must be a party to the booking. **10MB per object limit** (set in the bucket's file size limit setting). |
| `credentials` | No | Licence, insurance and photo ID documents (`contractor_credentials` table) | Read: the owning contractor plus admins. Write: the owning contractor only. |
| `invoices` | No | Generated tax invoice / payout statement PDFs (`invoices` table) | Read: the parties named in the `invoices` row (`recipient`). Write: service-role only (invoices are generated server-side on release, never uploaded by a client). |

For each bucket, add Storage policies (Dashboard -> Storage -> bucket -> Policies) equivalent to:

```sql
-- job-photos: party-scoped
CREATE POLICY "job-photos read (party)" ON storage.objects FOR SELECT
  USING (bucket_id = 'job-photos' AND (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id::text = (storage.foldername(name))[1]
            AND (b.customer_id = auth.uid() OR b.contractor_id = auth.uid()))
    OR public.is_admin(auth.uid())
  ));

CREATE POLICY "job-photos write (party)" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'job-photos' AND
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id::text = (storage.foldername(name))[1]
            AND (b.customer_id = auth.uid() OR b.contractor_id = auth.uid())));

-- credentials: owner-write, admin-read
CREATE POLICY "credentials owner write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'credentials' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "credentials owner or admin read" ON storage.objects FOR SELECT
  USING (bucket_id = 'credentials' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid())
  ));

-- invoices: party-read only, no client write path (service role bypasses RLS)
CREATE POLICY "invoices party read" ON storage.objects FOR SELECT
  USING (bucket_id = 'invoices' AND EXISTS (
    SELECT 1 FROM public.invoices i JOIN public.bookings b ON b.id = i.booking_id
    WHERE i.storage_path = storage.objects.name
      AND (b.customer_id = auth.uid() OR b.contractor_id = auth.uid())
  ));
```

These assume the convention of storing objects at `<booking_id>/<filename>` (job-photos), `<profile_id>/<filename>` (credentials), and matching `invoices.storage_path` exactly (invoices). Adjust the path convention in `lib/invoices.js` and the Phase 7 upload code to match if you change it.

## What the migration does NOT do

- It does not touch `auth.users` directly beyond the `handle_new_user()` trigger. Real user rows only come from an actual Google/Apple/email sign-up.
- It does not seed any `bookings`, `quotes` or other user-scoped demo rows, because those all require a real `auth.users` row to reference. Sign up for real in your dev project first, then use it interactively, or write your own dev-only seed once you have a test user's UUID.
- It does not enable Realtime on `notifications`/`bookings`/`quotes` if the `supabase_realtime` publication doesn't already exist on your project (it does by default on all Supabase projects created after 2022, but if the `ALTER PUBLICATION` statements in `0001_init.sql` raise a notice instead of applying, enable Realtime for those three tables manually via **Database -> Replication** in the Dashboard).

## Verifying

After applying, run `supabase/verify.sql` and check its output against the expectations documented inline as comments. In particular, confirm section 8 (column-level privileges) does **not** list `role`, `provider_account_id`, `kyc_status`, `paused`, `paused_reason`, `rating_avg` or `rating_count` as columns `authenticated` can update, this is what stops a signed-in user from promoting themselves to admin or unpausing their own paused contractor account.
