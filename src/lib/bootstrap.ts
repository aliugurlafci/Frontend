/**
 * Platform bootstrap — wires the cross-cutting event subscribers once.
 *
 * Called after the store is seeded so the search reindex has data. Idempotent:
 * each registrar guards against double-subscription.
 */
import { registerWorkflows } from "@/lib/workflow/workflows";
import { registerSearchIndexing, reindexAll } from "@/lib/search/indexer";
import { registerCacheInvalidation } from "@/lib/cache/invalidation";
import { registerWebhookDelivery } from "@/lib/integrations/webhooks";
import { registerNotifications } from "@/lib/integrations/notifications";
import { seedFeatureFlags } from "@/lib/config/feature-flags";

let booted = false;

export function ensurePlatform(): void {
  if (booted) return;
  booted = true;
  seedFeatureFlags();
  registerWorkflows();
  registerSearchIndexing();
  registerCacheInvalidation();
  registerWebhookDelivery();
  registerNotifications();
  reindexAll();
}
