import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/customer/", "/pro/", "/manager/", "/field/", "/supervisor/", "/command/", "/portal/"],
    },
    sitemap: "https://getcrew.com.au/sitemap.xml",
  };
}
