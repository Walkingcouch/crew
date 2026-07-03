# Crew Platform: Full Setup Guide

## What you now have

| File | Purpose |
|------|---------|
| `vercel.json` | Deployment config, routing, security headers |
| `manifest.json` | PWA: makes the app installable |
| `sw.js` | Service worker: offline support |
| `crew-framework.js` | Shared JS used by all apps |
| `auth.html` | Updated: beta gate + PWA meta + SW registration |
| `404.html` | Custom not-found page |
| `.env.example` | Template for environment variables |
| `supabase/schema.sql` | Database tables, beta allowlist, RLS policies |
| `supabase/functions/send-report-email/index.ts` | Edge function for report emails |

---

## Step 1: Supabase: Run the schema

1. Go to **Supabase Dashboard** → your project → **SQL Editor**
2. Click **New query**
3. Paste the entire contents of `supabase/schema.sql`
4. Click **Run**

This creates:
- `profiles` table (auto-populated on signup)
- `beta_allowlist` table (only these emails can log in)
- `community_reports` table
- Row-level security on everything

**Add your email to the allowlist:**
In the SQL editor, run:
```sql
INSERT INTO public.beta_allowlist (email, note)
VALUES ('your@actualemail.com.au', 'Owner')
ON CONFLICT (email) DO NOTHING;
```

---

## Step 2: Supabase: Configure email OTP

1. Supabase Dashboard → **Authentication** → **Email**
2. Make sure **Enable Email** is ON
3. Set **Confirm email** to OFF (OTP handles this)
4. Go to **Authentication** → **Email Templates** → **Magic Link**
5. Customise the subject line to: `Your Crew login code`

**The OTP email will automatically go to whatever address you sign in with.**

---

## Step 3: Resend: Set up transactional email

1. Sign up at [resend.com](https://resend.com) (free tier: 100 emails/day)
2. **Add your domain**: Resend → Domains → Add → follow DNS instructions
3. **Create an API key**: API Keys → Create → copy it

---

## Step 4: Supabase: Deploy the Edge Function

Install Supabase CLI if you haven't:
```bash
npm install -g supabase
```

Login and link your project:
```bash
supabase login
supabase link --project-ref ggocdbsspynihtqlgozv
```

Set secrets (replace with your real values):
```bash
supabase secrets set RESEND_API_KEY=re_your_key_here
supabase secrets set EMAIL_FROM=hello@yourcustomdomain.com.au
supabase secrets set APP_URL=https://yourcustomdomain.com.au
```

Deploy the function:
```bash
supabase functions deploy send-report-email --no-verify-jwt
```

**Set up the database webhook** (so emails fire automatically):
1. Supabase Dashboard → **Database** → **Webhooks**
2. **Create a new webhook**:
   - Name: `on-new-report`
   - Table: `community_reports`
   - Events: `INSERT`
   - URL: `https://ggocdbsspynihtqlgozv.supabase.co/functions/v1/send-report-email`
   - HTTP method: POST
   - Add header: `Authorization: Bearer <your service role key>`

---

## Step 5: Vercel: Add your custom domain

1. Go to [vercel.com](https://vercel.com) → your Crew project
2. **Settings** → **Domains** → **Add**
3. Enter your domain (e.g. `getcrew.com.au`)
4. Vercel will show you DNS records to add

**In your domain registrar** (e.g. Namecheap, GoDaddy, Cloudflare):
```
Type    Name    Value
A       @       76.76.21.21
CNAME   www     cname.vercel-dns.com
```
DNS propagation: 5 to 30 minutes.

---

## Step 6: Vercel: Add environment variables

1. Vercel → your project → **Settings** → **Environment Variables**
2. Add each variable from `.env.example`:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ggocdbsspynihtqlgozv.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key |
| `RESEND_API_KEY` | your Resend key |
| `EMAIL_FROM` | `hello@yourcustomdomain.com.au` |
| `NEXT_PUBLIC_APP_URL` | `https://yourcustomdomain.com.au` |
| `BETA_ALLOWED_EMAILS` | comma-separated beta tester emails |

---

## Step 7: Deploy

Put all files in your project folder:
```
your-project/
├── index.html
├── auth.html           ← updated
├── 404.html            ← new
├── manifest.json       ← new
├── sw.js               ← new
├── vercel.json         ← new
├── crew-framework.js   ← new
├── .env.example        ← new (never commit .env.local)
├── rewards.html
├── rewards-tc.html
├── Customer_Portal.html
├── report-lead-gen-email.html
├── Crew_App_*.html
├── Command_Center_*.html
├── CrewBase_*.html
└── supabase/
    ├── schema.sql
    └── functions/
        └── send-report-email/
            └── index.ts
```

Deploy:
```bash
cd your-project
vercel --prod
```

---

## Step 8: Test the full flow

1. Visit `https://yourcustomdomain.com.au`
2. Click any CTA → redirected to `auth.html`
3. Enter **your email** → click Send Code
4. Check inbox → enter 6-digit code
5. ✅ You're in (you're on the beta allowlist)

Try with a non-allowlisted email:
6. Enter a **different email** → enter code
7. ✅ "This app is in private beta" message shown: access blocked

---

## PWA install (once deployed)

**On iPhone (Safari):**
1. Visit your domain in Safari
2. Tap the Share button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add**: Crew icon appears on home screen

**On Android (Chrome):**
1. Visit your domain
2. Chrome shows "Add Crew to Home Screen" banner automatically
3. Or tap ⋮ menu → **Add to Home Screen**

**On Desktop (Chrome/Edge):**
1. Visit your domain
2. Click the install icon in the address bar (⊕)

---

## Managing beta access

Add a tester:
```sql
INSERT INTO public.beta_allowlist (email, note)
VALUES ('newperson@example.com', 'Council tester');
```

Remove a tester:
```sql
DELETE FROM public.beta_allowlist WHERE email = 'person@example.com';
```

View all allowed users:
```sql
SELECT * FROM public.beta_allowlist ORDER BY added_at DESC;
```

---

## Your Supabase project details

- **Project URL:** `https://ggocdbsspynihtqlgozv.supabase.co`
- **Dashboard:** [https://supabase.com/dashboard/project/ggocdbsspynihtqlgozv](https://supabase.com/dashboard/project/ggocdbsspynihtqlgozv)
- Find your keys: Dashboard → Settings → API
