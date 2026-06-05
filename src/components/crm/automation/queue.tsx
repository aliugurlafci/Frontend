"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n/context";
import type { AutomationSettings, QueueItem, QueueState } from "./types";

const STATE_TONE: Record<QueueState, "info" | "warning" | "danger"> = {
  pending: "info",
  retry: "warning",
  dead: "danger",
};
const STATE_KEY: Record<QueueState, string> = {
  pending: "auto.q.state.pending",
  retry: "auto.q.state.retry",
  dead: "auto.q.state.dead",
};

export function QueueTab() {
  const { t } = useI18n();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [settings, setSettings] = useState<AutomationSettings | null>(null);

  async function load() {
    const [q, s] = await Promise.all([
      apiFetch<{ items: QueueItem[] }>(`/automation/queue`).then((r) => r.items).catch(() => []),
      apiFetch<AutomationSettings>(`/automation/settings`).catch(() => null),
    ]);
    setItems(q);
    setSettings(s);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function retry(item: QueueItem) {
    try {
      const r = await apiFetch<{ run: { status: string } }>(`/automation/queue/${item.id}/retry`, { method: "POST", body: {} });
      toast.success(t("auto.toast.retry", { status: r.run.status }));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function dismiss(item: QueueItem) {
    try {
      await apiFetch(`/automation/queue/${item.id}`, { method: "DELETE" });
      toast.success(t("auto.toast.queueRemoved"));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!items) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted">
        <Spinner /> {t("auto.loading")}
      </div>
    );
  }

  const groups: QueueState[] = ["pending", "retry", "dead"];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t("auto.q.throughput")} />
        <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label={t("auto.q.rateLimit")} value={settings ? `${settings.rateLimitPerMin}/min` : "—"} icon="activity" />
          <Metric label={t("auto.q.maxRetries")} value={settings ? String(settings.maxRetries) : "—"} icon="recurring" />
          <Metric label={t("auto.q.inRetry")} value={String(items.filter((i) => i.state === "retry").length)} icon="recurring" tone="text-warning" />
          <Metric label={t("auto.q.dead")} value={String(items.filter((i) => i.state === "dead").length)} icon="trash" tone="text-danger" />
        </CardBody>
      </Card>

      {items.length === 0 ? (
        <Card>
          <EmptyState icon="check" title={t("auto.q.empty.title")} description={t("auto.q.empty.desc")} />
        </Card>
      ) : (
        groups.map((state) => {
          const list = items.filter((i) => i.state === state);
          if (list.length === 0) return null;
          return (
            <Card key={state}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    {t(STATE_KEY[state])} <Badge tone={STATE_TONE[state]}>{list.length}</Badge>
                  </span>
                }
              />
              <CardBody className="space-y-2">
                {list.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-2/40 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{item.ruleName}</div>
                      <div className="text-xs text-muted">
                        {t("auto.q.attempt", { a: String(item.attempts), m: String(item.maxAttempts) })}
                        {item.nextAttemptAt && ` · ${t("auto.q.next", { t: new Date(item.nextAttemptAt).toLocaleTimeString() })}`}
                        {` · ${t("auto.q.queued", { t: new Date(item.enqueuedAt).toLocaleTimeString() })}`}
                      </div>
                      {item.lastError && <div className="mt-0.5 text-xs text-danger">{item.lastError}</div>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button size="xs" variant="outline" onClick={() => retry(item)}>
                        <Icon name="recurring" className="h-3 w-3" /> {t("auto.q.retry")}
                      </Button>
                      <button onClick={() => dismiss(item)} aria-label={t("auto.q.dismiss")} className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          );
        })
      )}
    </div>
  );
}

function Metric({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Icon name={icon} className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
