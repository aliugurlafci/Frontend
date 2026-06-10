/**
 * Server-side gateway to the backend API (BFF).
 *
 * Used by server components to read data from the standalone backend service
 * (server-to-server). It forwards the caller's identity — the persona cookie,
 * tenant/locale headers and any bearer token — so the backend resolves the same
 * principal, scope, permissions and PII projection the request would get
 * client-side. Responses match the backend contract one-to-one, so pages keep
 * the exact shapes the embedded services used to return.
 *
 * Server-only: imports `next/headers`. Never import from a client component.
 */
import { cache } from "react";
import { headers } from "next/headers";
import { backendApiBase } from "@/lib/config/backend";
import type { AggregateQuery, AggregateRow, Page, Query } from "@/lib/data/query";
import type { EntityRecord } from "@/lib/metadata/types";
import type { AuditEntry } from "@/lib/domain/audit";

/** Request headers forwarded to the backend so it sees the same caller. */
const FORWARDED_HEADERS = [
  "cookie",
  "authorization",
  "x-actor",
  "x-tenant",
  "x-locale",
  "accept-language",
  "x-correlation-id",
] as const;

async function forwardHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const incoming = await headers();
  const out: Record<string, string> = {};
  for (const key of FORWARDED_HEADERS) {
    const value = incoming.get(key);
    if (value) out[key] = value;
  }
  return { ...out, ...extra };
}

/** Thrown on a non-2xx backend response; carries the structured code + status. */
export class ServerApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ServerApiError";
  }
}

interface ErrorPayload {
  error?: { code?: string; message?: string };
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const hasBody = init?.body !== undefined;
  const reqHeaders = await forwardHeaders(hasBody ? { "content-type": "application/json" } : undefined);
  const res = await fetch(`${backendApiBase()}${path}`, {
    method: init?.method ?? "GET",
    headers: reqHeaders,
    body: hasBody ? JSON.stringify(init!.body) : undefined,
    // Pages that consume this are `dynamic = "force-dynamic"`; never cache data.
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as T & ErrorPayload;
  if (!res.ok) {
    throw new ServerApiError(
      res.status,
      json?.error?.code ?? "ERROR",
      json?.error?.message ?? `Backend request failed (${res.status})`,
    );
  }
  return json as T;
}

/** Serialize a typed list query into the backend's query-string contract. */
function listQueryString(query?: Query): string {
  if (!query) return "";
  const sp = new URLSearchParams();
  if (query.page) sp.set("page", String(query.page));
  if (query.pageSize) sp.set("pageSize", String(query.pageSize));
  if (query.search) sp.set("q", query.search);
  for (const s of query.sort ?? []) sp.append("sort", `${s.field}:${s.dir}`);
  for (const f of query.filters ?? []) {
    // The list endpoint expresses equality filters via the query string; richer
    // predicates (ranges, IN) go through `/aggregate`.
    if (f.op === "eq" && !Array.isArray(f.value)) sp.append(`filter.${f.field}`, String(f.value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

const id = (s: string) => encodeURIComponent(s);

/** Master-detail document (quote/invoice) as returned by the finance endpoints. */
export interface DocumentResult {
  doc: EntityRecord;
  lines: EntityRecord[];
}

export interface JobStatus {
  name: string;
  label: string;
  schedule: string;
  last?: { name: string; at: string; summary: string };
}

export interface NotificationItem {
  id: string;
  channel: string;
  subject: string;
  at: string;
  [key: string]: unknown;
}

export interface ReleaseEntry {
  id: string;
  kind: string;
  note?: string | null;
  actor: string;
  at: string;
}

/** The signed-in user, their position and the screens they may open. */
export interface MeResult {
  userId: string;
  displayName: string;
  email: string;
  roles: string[];
  tenantId: string;
  orgId: string;
  locale: string;
  featureFlags: Record<string, boolean>;
  positionId: string | null;
  position: { id: string; name: string; role: string } | null;
  screens: string[];
  /** Effective operation grants (matrix-authoritative, else role defaults). */
  grants: string[];
  phone: string | null;
  timezone: string | null;
  avatarId: string | null;
  jobTitle: string | null;
  location: string | null;
  bio: string | null;
  twoFactorEnabled: boolean;
  /** Structured notification prefs (or the legacy flat event→channels map). */
  notificationPrefs: Record<string, unknown> | null;
  /** Per-user config (theme/accent/density/mailSyncInterval…) from the userSetting table. */
  settings: Record<string, string>;
}

/**
 * The backend gateway. Each method maps to a `/api/v1` endpoint and returns the
 * same shape the embedded domain/finance services used to return in-process.
 */
export const serverApi = {
  /** List records (paged, filtered, sorted). */
  list: (entity: string, query?: Query) =>
    request<Page>(`/entities/${id(entity)}${listQueryString(query)}`),

  /** Lightweight mailbox listing — preview only; full body fetched lazily on open. */
  emailList: (page: number) =>
    request<{ items: Record<string, unknown>[]; pageCount: number }>(`/email/list?page=${page}`),

  /** Fetch a single record by id. */
  get: (entity: string, recordId: string) =>
    request<EntityRecord>(`/entities/${id(entity)}/${id(recordId)}`),

  /** Grouped aggregation for reports/dashboards. */
  aggregate: async (entity: string, query: AggregateQuery): Promise<AggregateRow[]> => {
    const { rows } = await request<{ rows: AggregateRow[] }>(`/aggregate`, {
      method: "POST",
      body: { entity, groupBy: query.groupBy, measures: query.measures, filters: query.filters },
    });
    return rows;
  },

  /** Recent tenant audit activity (dashboard / activity feed). */
  activity: async (limit = 12): Promise<AuditEntry[]> => {
    const { entries } = await request<{ entries: AuditEntry[] }>(`/activity?limit=${limit}`);
    return entries;
  },

  /** A finance document (quote/invoice) with its lines. */
  document: (kind: "quote" | "invoice", docId: string) =>
    request<DocumentResult>(`/${kind === "quote" ? "quotes" : "invoices"}/${id(docId)}`),

  /** Scheduled-job registry with last-run status (admin automation screen). */
  jobs: async (): Promise<JobStatus[]> => {
    const { jobs } = await request<{ jobs: JobStatus[] }>(`/jobs`);
    return jobs;
  },

  /** Recent notifications + unread count. */
  notifications: () => request<{ items: NotificationItem[]; unread: number }>(`/notifications`),

  /** Governed release/audit trail (admin only; empty for non-admins). */
  releases: async (): Promise<ReleaseEntry[]> => {
    const { releases } = await request<{ releases: ReleaseEntry[] }>(`/admin/releases`);
    return releases;
  },

  /** The signed-in user + their allowed screens (from /auth/me).
   *  Cached per request so multiple server components (AppShell, dashboard cards)
   *  share a single backend round-trip. */
  me: cache((): Promise<MeResult> => request<MeResult>(`/auth/me`)),

  /** The full screen catalog (for the admin position editor). */
  screens: async (): Promise<ScreenDef[]> => {
    const { screens } = await request<{ screens: ScreenDef[] }>(`/screens`);
    return screens;
  },

  /** Permission catalog (admin only): entities + grantable operations + role presets. */
  permissionsCatalog: async (): Promise<PermissionCatalog> => {
    return request<PermissionCatalog>(`/permissions/catalog`);
  },

  /** All login users without their password hash (admin only). */
  adminUsers: async (): Promise<Record<string, unknown>[]> => {
    const { users } = await request<{ users: Record<string, unknown>[] }>(`/admin/users`);
    return users;
  },
};

export interface PermissionCatalog {
  entities: { name: string; group: string; actions: string[] }[];
  special: string[];
  roles: { value: string; grants: string[] }[];
}

export interface ScreenDef {
  key: string;
  label: string;
  group: string;
}
