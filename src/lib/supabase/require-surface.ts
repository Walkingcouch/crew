import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "./server";
import type { ProfileRole } from "./database.types";

/** Which profiles.role values may access which role surface. Admin and
 * crewbase_admin both reach every surface (ground rule: "role gates with
 * admin and crewbase_admin parity"). Kept in sync with ROLE_HOME below. */
const SURFACE_ROLES: Record<string, ProfileRole[]> = {
  customer: ["customer", "admin", "crewbase_admin"],
  pro: ["crew_member", "admin", "crewbase_admin"],
  manager: ["crew_manager", "admin", "crewbase_admin"],
  field: ["field_worker", "admin", "crewbase_admin"],
  supervisor: ["supervisor", "admin", "crewbase_admin"],
  command: ["admin", "crewbase_admin"],
};

const ROLE_HOME: Record<ProfileRole, string> = {
  customer: "/customer",
  crew_member: "/pro",
  crew_manager: "/manager",
  field_worker: "/field",
  supervisor: "/supervisor",
  admin: "/command",
  crewbase_admin: "/command",
};

/**
 * Server Component auth/role gate for a surface layout. Runs in the
 * Node.js runtime (not Edge), unlike the old middleware.ts-based version:
 * calling @supabase/ssr's createServerClient() from Edge Middleware
 * crashed every request in production with "ReferenceError: __dirname is
 * not defined" (see DECISIONS.md, the Phase 9 production-incident entry),
 * so the redirect-unauthenticated-users/wrong-role logic now lives here,
 * called from the top of each surface's layout.tsx, instead of running
 * once centrally before every request. A layout.tsx Server Component has
 * no simple, version-stable way to read the exact requested sub-path (the
 * way middleware could), so an unauthenticated visitor is sent to
 * `/login?next=/<surface>` (the surface root), not the precise deep link
 * they tried to open, a minor simplification versus the old behaviour.
 */
export async function requireSurfaceAccess(surface: keyof typeof SURFACE_ROLES) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/${surface}`)}`);
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  const role = profile?.role;
  const allowedRoles = SURFACE_ROLES[surface];
  if (!role || !allowedRoles?.includes(role)) {
    redirect(role ? ROLE_HOME[role] : "/login");
  }
}
