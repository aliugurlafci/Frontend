/**
 * Phase 9 — API plumbing.
 *
 * `runApi` wraps every route handler with: context resolution (Phase 4),
 * per-principal rate limiting + CSRF (Phase 13), structured error serialization
 * (Phase 3), API versioning headers and request metrics (Phase 11). Handlers
 * just return data; transport concerns live here.
 */
import { NextResponse } from "next/server";
import { resolveContext } from "@/lib/context/resolver";
import type { RequestContext } from "@/lib/context/types";
import { ForbiddenError, NotFoundError, RateLimitError, toAppError } from "@/lib/enforcement/errors";
import { metadata } from "@/lib/metadata";
import { CSRF_COOKIE, CSRF_HEADER, verifyCsrf } from "@/lib/security/csrf";
import { rateLimit } from "@/lib/security/rate-limit";
import { logger } from "@/lib/observability/logger";
import { metrics } from "@/lib/observability/metrics";
import type { Filter, Query, Sort } from "@/lib/data/query";

export const API_VERSION = "1";

export interface ApiOptions {
  mutating?: boolean;
  status?: number;
  rateLimit?: { limit: number; windowMs: number };
}

function readCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function jsonResponse(data: unknown, status = 200, correlationId?: string): NextResponse {
  const res = NextResponse.json(data as object, { status });
  res.headers.set("x-api-version", API_VERSION);
  if (correlationId) res.headers.set("x-correlation-id", correlationId);
  return res;
}

export async function runApi(
  req: Request,
  fn: (ctx: RequestContext) => Promise<unknown>,
  opts: ApiOptions = {},
): Promise<NextResponse> {
  let ctx: RequestContext | undefined;
  try {
    ctx = resolveContext(req.headers);
    metrics.increment("api.requests");

    const path = new URL(req.url).pathname;
    const rl = rateLimit(
      `${ctx.userId}:${path}`,
      opts.rateLimit?.limit ?? 240,
      opts.rateLimit?.windowMs ?? 60_000,
    );
    if (!rl.allowed) throw new RateLimitError(rl.retryAfter);

    if (opts.mutating) {
      // Double-submit CSRF: enforced when the client set the cookie (browser).
      const cookie = readCookie(req, CSRF_COOKIE);
      if (cookie && !verifyCsrf(req.headers.get(CSRF_HEADER), cookie)) {
        throw new ForbiddenError("CSRF token mismatch");
      }
    }

    const data = await fn(ctx);
    return jsonResponse(data, opts.status ?? 200, ctx.correlationId);
  } catch (error) {
    const appError = toAppError(error);
    if (appError.httpStatus >= 500) {
      logger.error("api error", {
        error: appError.message,
        correlationId: ctx?.correlationId,
      });
    }
    metrics.increment("api.errors");
    return jsonResponse(appError.serialize(ctx?.correlationId), appError.httpStatus, ctx?.correlationId);
  }
}

/**
 * Parse list query params:
 *   ?q=&page=&pageSize=&sort=field:dir&sort=field2:asc&filter.<field>=value
 * Numeric filter values are coerced so equality matches typed columns.
 */
export function parseListQuery(req: Request): Query {
  const url = new URL(req.url);
  const sp = url.searchParams;
  const sort: Sort[] = sp.getAll("sort").map((s) => {
    const [field, dir] = s.split(":");
    return { field, dir: dir === "desc" ? "desc" : "asc" };
  });
  const filters: Filter[] = [];
  for (const [key, raw] of sp.entries()) {
    if (!key.startsWith("filter.") || raw === "") continue;
    const field = key.slice("filter.".length);
    const value = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
    filters.push({ field, op: "eq", value });
  }
  const query: Query = {};
  if (sp.get("q")) query.search = sp.get("q")!;
  if (sp.get("page")) query.page = Number(sp.get("page"));
  if (sp.get("pageSize")) query.pageSize = Number(sp.get("pageSize"));
  if (sort.length) query.sort = sort;
  if (filters.length) query.filters = filters;
  return query;
}

/** Throw a 404 if the entity isn't in the active metadata. */
export function assertKnownEntity(entity: string): void {
  if (!metadata.findEntity(entity)) throw new NotFoundError("entity", entity);
}

/** Parse an `If-Match` header into an expected version for optimistic locking. */
export function parseIfMatch(req: Request): number | undefined {
  const header = req.headers.get("if-match");
  if (!header) return undefined;
  const n = Number(header.replace(/"/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
