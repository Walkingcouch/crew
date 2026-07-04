import type { Router } from "express";
import { handleWithRouter } from "./express-adapter";

/**
 * Builds the GET/POST/PUT/DELETE exports for a Next.js catch-all Route
 * Handler (app/api/<group>/[...path]/route.ts) that forwards to an
 * existing Express Router mounted (in the legacy server.js) at the same
 * `/<prefix>` path. One factory call replaces an entire router's worth of
 * one-off Route Handler files while keeping every existing endpoint's
 * tested logic untouched.
 */
export function createRouteHandlers(router: Router, prefix: string) {
  async function handler(request: Request, context: { params: Promise<{ path?: string[] }> }) {
    const { path } = await context.params;
    const fullPath = `/${prefix}${path && path.length ? "/" + path.join("/") : ""}`;
    return handleWithRouter(router, request, fullPath);
  }

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    DELETE: handler,
    PATCH: handler,
  };
}
