import { buildManifest, SURFACE_MANIFESTS } from "@/server/lib/manifest";

export function GET() {
  return Response.json(buildManifest(SURFACE_MANIFESTS.field), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
