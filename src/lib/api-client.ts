import { createClient } from "@/lib/supabase/client";

/** The current session's Authorization header for calling our own
 * Route Handlers from a client component, empty object if signed out
 * (typed as a plain Record so spreading it into fetch's headers never
 * produces the {Authorization?: undefined} union HeadersInit rejects). */
export async function authHeader(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}
