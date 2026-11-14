import type { MetadataRoute } from "next";

// Keep the private beta crawlable so search engines can read the noindex metadata.
// robots.txt disallow alone would prevent crawlers from seeing the noindex directive.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
  };
}
