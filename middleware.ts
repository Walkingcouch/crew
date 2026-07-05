import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Turbopack's middleware-specific bundler pass does not inline any local
// file import in middleware.ts (tested both the "@/*" alias and a plain
// relative path; both produced a middleware.js with the bare, unresolved
// import left in the output, which Vercel's Edge Function packaging then
// rejects as "referencing unsupported modules"). Every in-src/ file
// resolves fine, this only affects the root-level middleware.ts entry
// point. Fix: middleware.ts imports only npm packages (which Turbopack
// does bundle correctly) and inlines everything else, including the
// session-refresh logic that used to live in src/lib/supabase/middleware.ts
// and the ProfileRole type that used to come from database.types.ts.
type ProfileRole = "customer" | "crew_member" | "crew_manager" | "field_worker" | "supervisor" | "admin" | "crewbase_admin";

/** Which profiles.role values may access which role surface. Admin and
 * crewbase_admin both reach /command (ground rule: "role gates with admin
 * and crewbase_admin parity"). */
const SURFACE_ROLES: Record<string, ProfileRole[]> = {
  "/customer": ["customer", "admin", "crewbase_admin"],
  "/portal": ["customer", "admin", "crewbase_admin"],
  "/pro": ["crew_member", "admin", "crewbase_admin"],
  "/manager": ["crew_manager", "admin", "crewbase_admin"],
  "/field": ["field_worker", "admin", "crewbase_admin"],
  "/supervisor": ["supervisor", "admin", "crewbase_admin"],
  "/command": ["admin", "crewbase_admin"],
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

/** Maps a TWA subdomain to its default surface, so the existing Android
 * APKs (which wrap a fixed URL per subdomain) keep working unchanged.
 * pro.getcrew.com.au serves /pro by default; a crew_manager visiting it
 * still gets redirected to /manager by the role gate below. */
const SUBDOMAIN_SURFACE: Record<string, string> = {
  app: "/customer",
  pro: "/pro",
  field: "/field",
  supervisor: "/supervisor",
  command: "/command",
};

function protectedSurfaceFor(pathname: string): string | null {
  for (const surface of Object.keys(SURFACE_ROLES)) {
    if (pathname === surface || pathname.startsWith(`${surface}/`)) return surface;
  }
  return null;
}

/** Refreshes the Supabase session cookie on every request, inlined from
 * the old src/lib/supabase/middleware.ts (see the Turbopack note above). */
async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user, supabase };
}

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Subdomain routing for the TWA APKs: getcrew.com.au itself is unaffected.
  const host = request.headers.get("host") || "";
  const subdomain = host.split(".")[0];
  if (subdomain && SUBDOMAIN_SURFACE[subdomain] && pathname === "/") {
    return NextResponse.redirect(new URL(SUBDOMAIN_SURFACE[subdomain], request.url));
  }

  const surface = protectedSurfaceFor(pathname);
  if (!surface) return response;

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single<{ role: ProfileRole }>();

  const role = profile?.role;
  const allowedRoles = SURFACE_ROLES[surface];
  if (!role || !allowedRoles?.includes(role)) {
    const home = role ? ROLE_HOME[role] : "/login";
    return NextResponse.redirect(new URL(home, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static files, images, and Next.js internals.
     * The role-gate DB query only actually fires for the surface paths
     * checked above; everything else short-circuits at `if (!surface)`.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
