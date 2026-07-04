import type { MetadataRoute } from "next";

const BASE_URL = "https://getcrew.com.au";

const MARKETING_PATHS = [
  "",
  "about",
  "contractors",
  "case-studies",
  "blog",
  "apps",
  "terms",
  "privacy",
  "complaints",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return MARKETING_PATHS.map((path) => ({
    url: `${BASE_URL}/${path}`,
    lastModified: new Date(),
  }));
}
