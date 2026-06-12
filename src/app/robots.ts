import type { MetadataRoute } from "next";

/**
 * /robots.txt — allow search engines to crawl the public site; only the API is
 * off-limits. Authenticated app routes redirect crawlers to /login, so private
 * pages aren't indexed even though they're crawlable.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
  };
}
