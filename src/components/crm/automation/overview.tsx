"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n/context";
import { RunJobsButton } from "../automation-admin";
import type { AutomationStatsResponse, AutomationRun } from "./types";
import { RUN_TONE, STATUS_TONE } from "./types";

interface JobStatus {
  name: string;
  label: string;
  schedule: string;
  last?: { summary: string; at: string };
}

function Kpi({ icon, label, value, sub, tone }: { icon: string; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="relative">
        <span className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r", tone ?? "from-primary to-secondary")} aria-hidden />
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
          <Icon name={icon} className="h-3.5 w-3.5" /> {label}
        </div>
        <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </CardBody>
    </Card>
  );
}

export function OverviewTab({ onJump }: { onJump: (tab: string) => void }) {
  const { t } = useI18n();
  const [stats, setStats] = useState<AutomationStatsResponse | null>(null);
  const [jobs, setJobs] = useState<JobStatus[]>([]);

  async function load() {
    const [s, j] = await Promise.all([
      apiFetch<AutomationStatsResponse>(`/automation/stats`).catch(() => null),
      apiFetch<{ jobs: JobStatus[] }>(`/jobs`).then((r) => r.jobs).catch(() => []),
    ]);
    setStats(s);
    setJobs(j);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted">
        <Spinner /> {t("auto.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon="recurring" label={t("auto.kpi.active")} value={String(stats.active)} sub={t("auto.kpi.activeSub", { total: String(stats.total), draft: String(stats.draft) })} tone="from-success to-info" />
        <Kpi icon="activity" label={t("auto.kpi.runs")} value={stats.runs.toLocaleString()} sub={t("auto.kpi.runsSub", { ok: String(stats.success), failed: String(stats.failure) })} />
        <Kpi icon="shield" label={t("auto.kpi.successRate")} value={`${stats.successRate}%`} sub={t("auto.kpi.successRateSub", { ms: String(stats.avgMs) })} tone={stats.successRate >= 90 ? "from-success to-info" : "from-warning to-danger"} />
        <Kpi icon="trending" label={t("auto.kpi.impact")} value={stats.impact.toLocaleString()} sub={t("auto.kpi.impactSub")} tone="from-secondary to-primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t("auto.recentRuns")} action={<button onClick={() => onJump("logs")} className="text-xs font-medium text-primary hover:underline">{t("auto.viewAllLogs")}</button>} />
          <CardBody className="space-y-1.5">
            {stats.recentRuns.length === 0 && <p className="text-sm text-muted">{t("auto.noRuns")}</p>}
            {stats.recentRuns.map((run: AutomationRun) => (
              <div key={run.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2/60">
                <span className="flex min-w-0 items-center gap-2">
                  <Badge tone={RUN_TONE[run.status]}>{run.status}</Badge>
                  <span className="truncate font-medium">{run.ruleName}</span>
                  <span className="hidden truncate text-xs text-muted sm:inline">· {run.trigger}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{run.durationMs} ms · {new Date(run.finishedAt).toLocaleTimeString()}</span>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("auto.queue.title")} action={<button onClick={() => onJump("queue")} className="text-xs font-medium text-primary hover:underline">{t("auto.manage")}</button>} />
          <CardBody className="space-y-2">
            <QueueStat label={t("auto.queue.pending")} value={stats.queue.pending} tone="info" />
            <QueueStat label={t("auto.queue.retry")} value={stats.queue.retry} tone="warning" />
            <QueueStat label={t("auto.queue.dead")} value={stats.queue.dead} tone="danger" />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("auto.topRules")} />
          <CardBody className="space-y-2">
            {stats.topRules.length === 0 && <p className="text-sm text-muted">{t("auto.noRules")}</p>}
            {stats.topRules.map((r) => (
              <div key={r.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[r.status]}>{t(`auto.status.${r.status}`)}</Badge>
                    <span className="font-medium">{r.name}</span>
                  </span>
                  <span className="text-xs text-muted">{r.runs} {t("auto.runsLabel")} · {r.successRate}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${r.successRate}%` }} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("auto.scheduledJobs")} action={<RunJobsButton />} />
          <CardBody className="space-y-2 text-sm">
            <p className="text-xs text-muted">{t("auto.cronNote")}</p>
            {jobs.map((j) => (
              <div key={j.name} className="flex items-center justify-between border-b border-border pb-1.5 last:border-0">
                <div>
                  <div className="font-medium">{j.label}</div>
                  <div className="text-xs text-muted">schedule: {j.schedule}</div>
                </div>
                <div className="text-right text-xs">
                  {j.last ? (
                    <>
                      <Badge tone="success">{j.last.summary}</Badge>
                      <div className="text-muted">{new Date(j.last.at).toLocaleString()}</div>
                    </>
                  ) : (
                    <span className="text-muted-2">{t("auto.neverRun")}</span>
                  )}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function QueueStat({ label, value, tone }: { label: string; value: number; tone: "info" | "warning" | "danger" }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-3 py-2">
      <span className="text-sm text-muted">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}
