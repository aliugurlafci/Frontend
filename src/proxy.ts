/**
 * Security proxy + auth gate (Next 16 `proxy` convention, formerly middleware).
 *
 * - Redirects unauthenticated page requests to /login (login gate). The session
 *   is the httpOnly `aula_session` cookie set by the backend at login.
 * - Forwards the request path to server components as `x-pathname` so the layout
 *   can render auth pages chrome-less and the shell can enforce screen access.
 * - Adds hardening headers and issues the double-submit CSRF cookie.
 *
 * Self-contained / edge-safe — no shared module imports.
 */
import { NextResponse, type NextRequest } from "next/server";

const CSRF_COOKIE = "aula_csrf";
const SESSION_COOKIE = "aula_session";

/** Pages reachable without a session (auth + status screens). */
const PUBLIC_PAGES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/email-verification",
  "/two-step-verification",
  "/lock-screen",
  "/coming-soon",
  "/under-maintenance",
  "/error-500",
];

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api");
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE));

  // Login gate: page requests (not API/assets) without a session → /login.
  if (!isApi && !isPublicPage(pathname) && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // Already signed in but on the login page → send to the app.
  if (hasSession && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Expose the path to server components (chrome-less layout + screen gate).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("x-content-type-options", "nosniff");
  res.headers.set("x-frame-options", "DENY");
  res.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  res.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");

  if (!req.cookies.get(CSRF_COOKIE)) {
    res.cookies.set(CSRF_COOKIE, randomToken(), { sameSite: "lax", path: "/" });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
