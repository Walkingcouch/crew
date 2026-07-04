import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/** Server-side Supabase client for use in Server Components, Route
 * Handlers and Server Actions. Uses the anon key plus the caller's own
 * session cookie, RLS still applies, this is not the service-role client. */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database, "public">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component that can't set cookies; the
            // middleware refreshes the session on every request instead.
          }
        },
      },
    },
  );
}
