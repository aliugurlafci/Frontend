import type { NextConfig } from "next";

/**
 * Backend-for-frontend proxy.
 *
 * The browser only ever talks to this app's own origin. Every `/api/v1/*`
 * request (client `apiFetch`, CSV export links, form posts) is rewritten to the
 * standalone backend service, so cookies stay first-party and the backend URL is
 * never exposed to the client. Server components call the backend directly via
 * `serverApi` (see `src/lib/http/server-api.ts`).
 *
 * Set `BACKEND_API_URL` to point at the backend (default: http://localhost:4000).
 */
const backendUrl = (process.env.BACKEND_API_URL || "http://localhost:4000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // Allow large request bodies through the /api/v1 rewrite proxy (file uploads).
  // Must exceed the backend's 25 MB upload cap so the proxy doesn't truncate the
  // body (which otherwise resets the upstream connection). Default proxy cap is 10 MB.
  experimental: {
    proxyClientMaxBodySize: "100mb",
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
