import { buildManifest, SURFACE_MANIFESTS } from "@/server/lib/manifest";

export function GET() {
  return Response.json(buildManifest(SURFACE_MANIFESTS.manager), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
