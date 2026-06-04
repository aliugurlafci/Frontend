/**
 * Phase 12 — test helpers.
 *
 * Builds a fresh, isolated stack (in-memory repo + query engine + domain
 * service with a private event bus) so tests don't share the seeded global
 * store. `makeCtx` fabricates request contexts for arbitrary roles/tenants.
 */
import { InMemoryRepository } from "@/lib/data/memory-repository";
import { QueryEngine } from "@/lib/data/query-engine";
import { metadata } from "@/lib/metadata";
import { permissionEngine } from "@/lib/permissions/engine";
import { InMemoryEventBus } from "@/lib/workflow/event-bus";
import { IdempotencyStore } from "@/lib/workflow/idempotency";
import { AuditLog } from "@/lib/domain/audit";
import { DomainService } from "@/lib/domain/service";
import type { RequestContext } from "@/lib/context/types";

export function makeCtx(over: { roles: string[]; userId: string } & Partial<RequestContext>): RequestContext {
  return {
    tenantId: "t_test",
    orgId: "o_test",
    displayName: "Test User",
    email: "test@aula.crm",
    locale: "en",
    featureFlags: {},
    correlationId: "cid_test",
    at: "2026-06-01T00:00:00.000Z",
    isSystem: false,
    ...over,
  };
}

export function buildStack() {
  const repo = new InMemoryRepository();
  const bus = new InMemoryEventBus();
  const idempotency = new IdempotencyStore();
  const audit = new AuditLog();
  const qe = new QueryEngine(repo, metadata, permissionEngine);
  const domain = new DomainService(qe, metadata, permissionEngine, bus, idempotency, audit);
  return { repo, bus, idempotency, audit, qe, domain };
}
