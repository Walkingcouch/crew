import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/lib/supabase/database.types";

const ROLE_HOME: Record<ProfileRole, string> = {
  customer: "/customer",
  crew_member: "/pro",
  crew_manager: "/manager",
  field_worker: "/field",
  supervisor: "/supervisor",
  admin: "/command",
  crewbase_admin: "/command",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Completes sign-in for every method: Google/Apple arrive here with a
 * PKCE `code` to exchange; email+password already has a session by the
 * time LoginForm redirects here (signInWithPassword/signUp set it
 * directly), so this route also handles the no-code case by checking for
 * an existing session rather than assuming OAuth. Checks the beta
 * allowlist when BETA_MODE is on, retries the profile lookup 3 times over
 * ~3 seconds (the handle_new_user trigger that creates the profiles row
 * runs asynchronously after auth.users insert, so a profile fetched
 * immediately after sign-up can briefly 404), then redirects to the
 * user's role home, honouring ?next= if it was stashed before sign-in.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  const supabase = await createServerSupabaseClient();

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(exchangeError.message)}`);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  if (process.env.BETA_MODE === "true" && user.email) {
    const { data: allowed } = await supabase.rpc("is_beta_allowed", { p_email: user.email });
    if (!allowed) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/beta`);
    }
  }

  let role: ProfileRole | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile) {
      role = profile.role;
      break;
    }
    await sleep(1000);
  }

  const destination = next || (role ? ROLE_HOME[role] : "/customer");
  return NextResponse.redirect(`${origin}${destination}`);
}
