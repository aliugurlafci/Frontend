/**
 * Backend service location (BFF wiring).
 *
 * The Next.js app is a thin client of the standalone Aula CRM backend
 * (Express + MSSQL). Browser requests hit this app's own origin at `/api/v1/*`
 * and are transparently proxied to the backend (see `next.config.ts`); server
 * components fetch from the backend directly via `serverApi` (server-to-server).
 *
 * Configure the target with `BACKEND_API_URL` (server-side env). It is read at
 * request time — not inlined — so the same build runs against any environment.
 */
function normalize(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Origin of the backend service, e.g. `http://localhost:4000`. */
export function backendUrl(): string {
  return normalize(process.env.BACKEND_API_URL || "http://localhost:4000");
}

/** Versioned API base of the backend, e.g. `http://localhost:4000/api/v1`. */
export function backendApiBase(): string {
  return `${backendUrl()}/api/v1`;
}
