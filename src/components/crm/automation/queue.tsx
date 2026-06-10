"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import type { ReactNode } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n/context";
import type { AutomationSettings, QueueItem, QueueState, LiveActivity } from "./types";
import { CountUp, Skeleton } from "./anim";

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
  const [live, setLive] = useState<LiveActivity>({ running: [], recent: [] });
  const [processing, setProcessing] = useState(false);

  /** Refresh the queue + which rules are running right now (cheap; polled). */
  async function refresh() {
    const [q, l] = await Promise.all([
      apiFetch<{ items: QueueItem[] }>(`/automation/queue`).then((r) => r.items).catch(() => null),
      apiFetch<LiveActivity>(`/automation/live`).catch(() => null),
    ]);
    if (q) setItems(q);
    if (l) setLive(l);
  }

  async function load() {
    const s = await apiFetch<AutomationSettings>(`/automation/settings`).catch(() => null);
    setSettings(s);
    await refresh();
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  // Poll while the Queue tab is open so the pending list updates live: a running
  // automation is highlighted, and items drop the moment they finish.
  useEffect(() => {
    const id = setInterval(() => {
      void refresh();
    }, 1200);
    return () => clearInterval(id);
  }, []);

  const isRunning = (ruleId: string) => live.running.includes(ruleId);

  /** Drain the queue to completion (pending + due-retry items run until clear). */
  async function processAll() {
    setProcessing(true);
    try {
      const r = await apiFetch<{ processed: number; succeeded: number; remaining: number }>(`/automation/queue/process`, { method: "POST", body: {} });
      toast.success(t("auto.q.processDone", { processed: String(r.processed), succeeded: String(r.succeeded), remaining: String(r.remaining) }));
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  async function retry(item: QueueItem) {
    try {
      const r = await apiFetch<{ run: { status: string } }>(`/automation/queue/${item.id}/retry`, { method: "POST", body: {} });
      toast.success(t("auto.toast.retry", { status: r.run.status }));
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function dismiss(item: QueueItem) {
    try {
      await apiFetch(`/automation/queue/${item.id}`, { method: "DELETE" });
      toast.success(t("auto.toast.queueRemoved"));
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!items) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const groups: QueueState[] = ["pending", "retry", "dead"];

  const pendingCount = items.filter((i) => i.state !== "dead").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{t("auto.q.intro", { n: String(pendingCount) })}</p>
        <Button variant="primary" size="sm" loading={processing} disabled={pendingCount === 0} onClick={processAll}>
          <Icon name="recurring" className={cn("h-3.5 w-3.5", processing && "animate-spin")} /> {t("auto.q.process")}
        </Button>
      </div>

      <Card>
        <CardHeader title={t("auto.q.throughput")} />
        <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label={t("auto.q.rateLimit")} value={settings ? `${settings.rateLimitPerMin}/min` : "—"} icon="activity" />
          <Metric label={t("auto.q.maxRetries")} value={settings ? String(settings.maxRetries) : "—"} icon="recurring" />
          <Metric label={t("auto.q.inRetry")} value={<CountUp value={items.filter((i) => i.state === "retry").length} />} icon="recurring" tone="text-warning" />
          <Metric label={t("auto.q.dead")} value={<CountUp value={items.filter((i) => i.state === "dead").length} />} icon="trash" tone="text-danger" />
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
          const runningHere = list.filter((i) => isRunning(i.ruleId)).length;
          return (
            <Card key={state}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    {t(STATE_KEY[state])} <Badge tone={STATE_TONE[state]}>{list.length}</Badge>
                    {runningHere > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                        </span>
                        {t("auto.live.running", { n: String(runningHere) })}
                      </span>
                    )}
                  </span>
                }
              />
              <CardBody className="space-y-2">
                {list.map((item, ii) => {
                  const running = isRunning(item.ruleId);
                  return (
                    <div
                      key={item.id}
                      style={{ animationDelay: `${ii * 50}ms` }}
                      className={cn(
                        "animate-rise flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-all duration-300",
                        running ? "border-primary/50 bg-primary/5 ring-1 ring-primary/40" : "border-border bg-surface-2/40 hover:bg-surface-2",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {running && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                              </span>
                              {t("auto.running")}
                            </span>
                          )}
                          <span className="truncate">{item.ruleName}</span>
                        </div>
                        <div className="text-xs text-muted">
                          {t("auto.q.attempt", { a: String(item.attempts), m: String(item.maxAttempts) })}
                          {item.nextAttemptAt && ` · ${t("auto.q.next", { t: new Date(item.nextAttemptAt).toLocaleTimeString() })}`}
                          {` · ${t("auto.q.queued", { t: new Date(item.enqueuedAt).toLocaleTimeString() })}`}
                        </div>
                        {item.lastError && <div className="mt-0.5 text-xs text-danger">{item.lastError}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button size="xs" variant="outline" disabled={running} onClick={() => retry(item)}>
                          <Icon name="recurring" className={cn("h-3 w-3", running && "animate-spin")} /> {t("auto.q.retry")}
                        </Button>
                        <button onClick={() => dismiss(item)} aria-label={t("auto.q.dismiss")} className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
                          <Icon name="trash" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          );
        })
      )}
    </div>
  );
}

function Metric({ label, value, icon, tone }: { label: string; value: ReactNode; icon: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-border-strong">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Icon name={icon} className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
