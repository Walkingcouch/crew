/**
 * src/server/lib/auth-adapter.ts
 *
 * Adapts src/server/lib/require-user.js's Express-shaped middleware
 * (req, res, next) for use in Next.js Route Handlers, without touching
 * require-user.js itself, per the ground rule to port that module
 * unchanged. Builds a minimal req/res shim that captures the same
 * status/json outcome requireUser/requireAdmin would send to a real
 * Express response, then translates that into a plain result Route
 * Handlers can branch on.
 */

import type { User } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { requireUser, requireAdmin } = require("./require-user.js") as {
  requireUser: (req: unknown, res: unknown, next: () => void) => Promise<void>;
  requireAdmin: (req: unknown, res: unknown, next: () => void) => Promise<void>;
};

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; status: number; error: string };

function runMiddleware(
  middleware: (req: unknown, res: unknown, next: () => void) => Promise<void>,
  authHeader: string | null,
): Promise<AuthResult> {
  return new Promise((resolve) => {
    const req: { headers: { authorization: string }; user?: User } = {
      headers: { authorization: authHeader || "" },
    };
    const res = {
      status(code: number) {
        return {
          json(body: { error: string }) {
            resolve({ ok: false, status: code, error: body.error });
          },
        };
      },
    };
    middleware(req, res, () => {
      resolve({ ok: true, user: req.user as User });
    }).catch(() => {
      resolve({ ok: false, status: 401, error: "Authentication failed" });
    });
  });
}

/** Verifies the Bearer token from a Route Handler's Authorization header. */
export function authenticateRequest(request: Request): Promise<AuthResult> {
  return runMiddleware(requireUser, request.headers.get("authorization"));
}

/** Verifies the Bearer token AND that the caller has the admin or
 * crewbase_admin role (checked against profiles.role in the DB). */
export function authenticateAdminRequest(request: Request): Promise<AuthResult> {
  return runMiddleware(requireAdmin, request.headers.get("authorization"));
}
