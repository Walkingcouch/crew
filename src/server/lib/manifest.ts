export interface ManifestConfig {
  surfacePath: string;
  iconDir: string;
  name: string;
  themeColor: string;
}

export type SurfaceName = "customer" | "pro" | "manager" | "field" | "supervisor" | "command";

export const SURFACE_MANIFESTS: Record<SurfaceName, ManifestConfig> = {
  customer: { surfacePath: "/customer", iconDir: "customer", name: "Crew", themeColor: "#1a4d33" },
  pro: { surfacePath: "/pro", iconDir: "pro", name: "Crew for Contractors", themeColor: "#1e5aa8" },
  manager: { surfacePath: "/manager", iconDir: "manager", name: "Crew for Managers", themeColor: "#5b2d8e" },
  field: { surfacePath: "/field", iconDir: "field", name: "Crew Field", themeColor: "#c47b0a" },
  supervisor: { surfacePath: "/supervisor", iconDir: "supervisor", name: "Crew Supervisor", themeColor: "#0e7d6b" },
  command: { surfacePath: "/command", iconDir: "command", name: "Crew Command", themeColor: "#231f1a" },
};

/** Builds a per-surface web manifest object, one manifest per role so each
 * installs as its own home-screen icon with its own accent colour and
 * start_url, rather than one generic manifest for the whole app. */
export function buildManifest(config: ManifestConfig) {
  return {
    id: config.surfacePath,
    name: config.name,
    short_name: "Crew",
    description: "Australia's marketplace for lawn, garden and home services.",
    start_url: config.surfacePath,
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: config.themeColor,
    theme_color: config.themeColor,
    lang: "en-AU",
    categories: ["business", "utilities", "productivity"],
    icons: [
      { src: `/assets/icons/${config.iconDir}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/assets/icons/${config.iconDir}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: `/assets/icons/${config.iconDir}/icon-maskable-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `/assets/icons/${config.iconDir}/icon-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    related_applications: [],
    prefer_related_applications: false,
  };
}
