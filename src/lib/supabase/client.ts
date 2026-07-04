import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/** Browser-side Supabase client. Uses the anon key, safe to expose to the
 * client by design, RLS enforces every access boundary. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
