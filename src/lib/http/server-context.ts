/** Resolve the request context inside server components from the backend session. */
import { serverApi } from "@/lib/http/server-api";
import type { RequestContext } from "@/lib/context/types";

/**
 * The signed-in principal, sourced from the backend `/auth/me` (the source of
 * truth post-login) rather than the embedded dev resolver — so `displayName`,
 * `roles` and permission-based UI gating reflect the real logged-in user.
 */
export async function getServerContext(): Promise<RequestContext> {
  const me = await serverApi.me();
  return Object.freeze({
    tenantId: me.tenantId,
    orgId: me.orgId,
    userId: me.userId,
    displayName: me.displayName,
    email: me.email,
    roles: Object.freeze([...me.roles]),
    locale: me.locale ?? "en",
    featureFlags: Object.freeze(me.featureFlags ?? {}),
    correlationId: "ssr",
    at: new Date().toISOString(),
    isSystem: false,
  });
}
