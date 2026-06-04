"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
import { useSettings } from "@/components/ui/settings-provider";

const DEFAULT_SECONDS = 60;
const MIN_SECONDS = 15;

/**
 * App-wide background mail poller. Every N seconds (the per-user `mailSyncInterval`
 * setting, configurable in Settings → Notifications) it asks the backend to pull
 * the IMAP inbox; new mail creates notifications (shown in the topbar bell) and is
 * broadcast to the open mailbox via `aula:mail-synced`. Skips while the tab is hidden.
 */
export function AutoMailSync() {
  const { t } = useI18n();
  const { settings } = useSettings();
  const parsed = parseInt(settings.mailSyncInterval || "", 10);
  const intervalSeconds = Number.isFinite(parsed) && parsed >= MIN_SECONDS ? parsed : DEFAULT_SECONDS;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      timer.current = setTimeout(tick, intervalSeconds * 1000);
    };

    async function tick() {
      if (!document.hidden) {
        try {
          const res = await apiFetch<{ configured: boolean; synced: number }>("/email/sync", { method: "POST" });
          if (!cancelled && res.configured && res.synced > 0) {
            window.dispatchEvent(new CustomEvent("aula:mail-synced", { detail: { synced: res.synced } }));
            toast.success(t("email.syncedToast", { n: String(res.synced) }));
          }
        } catch {
          /* transient — try again next cycle */
        }
      }
      schedule();
    }

    schedule();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
    // Re-arm whenever the cadence changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalSeconds]);

  return null;
}
