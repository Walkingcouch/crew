# Crew Desktop — Download Files

This directory is a **local placeholder** for testing the download infrastructure.

## Production files go to Supabase Storage

Upload actual installers to the `downloads` Supabase Storage bucket. Public URLs:

| File | Supabase Storage URL |
|---|---|
| `crew-desktop-windows-setup.msi` | `https://ggocdbsspynihtqlgozv.supabase.co/storage/v1/object/public/downloads/crew-desktop-windows-setup.msi` |
| `crew-desktop-windows.zip` | `https://ggocdbsspynihtqlgozv.supabase.co/storage/v1/object/public/downloads/crew-desktop-windows.zip` |
| `crew-desktop-macos.dmg` | `https://ggocdbsspynihtqlgozv.supabase.co/storage/v1/object/public/downloads/crew-desktop-macos.dmg` |

## Local testing fallback

For local smoke-testing only, place files here and update the `href` values in
`index.html` to `/downloads/crew-desktop-windows-setup.msi` etc.
Vercel serves them with proper `Content-Disposition: attachment` headers
(configured in `vercel.json`).

## Schema

Run `downloads_schema.sql` in the Supabase SQL Editor to create:
- The `downloads` storage bucket
- The `download_counts` table
- The `increment_download_count(platform, app_name)` RPC function
