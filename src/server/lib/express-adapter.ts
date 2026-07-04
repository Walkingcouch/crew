/**
 * src/server/lib/express-adapter.ts
 *
 * Runs an existing Express Router (payments/routes.js, quotes-routes.js,
 * credentials-routes.js, availability-routes.js, admin-routes.js,
 * push-routes.js, all "KEEP, port do not redesign") inside a Next.js
 * Route Handler, so every one of those already-tested endpoints keeps its
 * exact request/response contract without hand-translating 30+ handlers
 * into new code that could quietly drift from the originals. Each
 * app/api/**\/route.ts file is a thin one-liner calling handleWithRouter
 * for its path, the Express router itself is untouched.
 *
 * Deliberately narrow: supports the JSON-body, params, query, and
 * status/json response shapes every route in this codebase actually uses.
 * Not a general-purpose Express-in-Next shim.
 */

import type { Router } from "express";

interface ExpressLikeRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
  params: Record<string, string>;
  user?: unknown;
  ip?: string;
}

/** Finds the layer in an Express 5 Router's internal stack whose path
 * pattern matches, and extracts :param values via the Layer's own public
 * `match()` method (Express 5 replaced the old regexp/keys-index approach
 * with path-to-regexp v8 matcher functions and no longer exposes a raw
 * `.regexp`, `.match()` is the supported way to both test and populate
 * `.params`, verified directly against the installed express@5.2.1). */
function matchRoute(router: Router, method: string, path: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stack: any[] = (router as any).stack;
  for (const layer of stack) {
    if (!layer.route) continue;
    const route = layer.route;
    if (!route.methods[method.toLowerCase()]) continue;
    if (!layer.match(path)) continue;
    const params: Record<string, string> = { ...layer.params };
    return { route, params };
  }
  return null;
}

/**
 * Executes the matching route on `router` for this Next.js request.
 * @param router     The Express Router exporting the target endpoint.
 * @param request    The incoming Next.js Request.
 * @param pathOverride  The path Express should match against (without the
 *                      Router's own mount prefix, since these routers are
 *                      normally mounted at '/api' in the legacy server.js).
 */
export async function handleWithRouter(
  router: Router,
  request: Request,
  pathOverride: string,
): Promise<Response> {
  const url = new URL(request.url);
  const match = matchRoute(router, request.method, pathOverride);

  if (!match) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  let body: unknown = undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  const req: ExpressLikeRequest = {
    method: request.method,
    path: pathOverride,
    headers,
    body,
    query,
    params: match.params,
    ip: headers["x-forwarded-for"]?.split(",")[0]?.trim() || "0.0.0.0",
  };

  return new Promise<Response>((resolve) => {
    let statusCode = 200;
    let sentHeaders: Record<string, string> = {};

    const res = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      setHeader(name: string, value: string) {
        sentHeaders[name] = value;
        return res;
      },
      json(payload: unknown) {
        resolve(Response.json(payload, { status: statusCode, headers: sentHeaders }));
      },
      send(payload?: unknown) {
        resolve(new Response(payload ? String(payload) : null, { status: statusCode, headers: sentHeaders }));
      },
    };

    // route.stack holds the handler chain (middleware + final handler);
    // run them in sequence the way Express itself would.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layers: any[] = match.route.stack;
    let i = 0;
    function next(err?: unknown) {
      if (err) {
        resolve(Response.json({ error: (err as Error).message || "Internal error" }, { status: 500 }));
        return;
      }
      const layer = layers[i++];
      if (!layer) {
        resolve(Response.json({ error: "No handler matched" }, { status: 500 }));
        return;
      }
      try {
        const result = layer.handle(req, res, next);
        if (result && typeof (result as Promise<unknown>).catch === "function") {
          (result as Promise<unknown>).catch(next);
        }
      } catch (err2) {
        next(err2);
      }
    }
    next();
  });
}
