import { buildManifest, SURFACE_MANIFESTS } from "@/server/lib/manifest";

export function GET() {
  return Response.json(buildManifest(SURFACE_MANIFESTS.pro), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
