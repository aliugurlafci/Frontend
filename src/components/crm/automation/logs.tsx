"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n/context";
import type { AutomationRun } from "./types";
import { RUN_TONE } from "./types";
import { Skeleton } from "./anim";

const STEP_TONE: Record<string, string> = {
  ok: "text-success",
  failed: "text-danger",
  skipped: "text-muted-2",
};

export function LogsTab() {
  const { t } = useI18n();
  const [runs, setRuns] = useState<AutomationRun[] | null>(null);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<AutomationRun | null>(null);
  const [retrying, setRetrying] = useState(false);

  async function load() {
    const qs = status ? `?status=${status}` : "";
    const r = await apiFetch<{ runs: AutomationRun[] }>(`/automation/runs${qs}`).catch(() => ({ runs: [] }));
    setRuns(r.runs);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function retry(run: AutomationRun) {
    setRetrying(true);
    try {
      const fresh = await apiFetch<AutomationRun>(`/automation/runs/${run.id}/retry`, { method: "POST", body: {} });
      toast.success(t("auto.toast.rerun", { status: fresh.status }));
      setSelected(fresh);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 w-auto text-xs">
          <option value="">{t("auto.logs.allStatuses")}</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </Select>
        <Button size="sm" variant="outline" onClick={load}>
          <Icon name="recurring" className="h-3.5 w-3.5" /> {t("auto.logs.refresh")}
        </Button>
      </div>

      {!runs ? (
        <Card className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </Card>
      ) : runs.length === 0 ? (
        <Card>
          <EmptyState icon="activity" title={t("auto.logs.empty.title")} description={t("auto.logs.empty.desc")} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <tr>
                <TH>{t("auto.logs.col.status")}</TH>
                <TH>{t("auto.logs.col.automation")}</TH>
                <TH>{t("auto.logs.col.trigger")}</TH>
                <TH>{t("auto.logs.col.steps")}</TH>
                <TH>{t("auto.logs.col.duration")}</TH>
                <TH>{t("auto.logs.col.when")}</TH>
              </tr>
            </THead>
            <tbody>
              {runs.map((run) => (
                <TR key={run.id} onClick={() => setSelected(run)} className="animate-rise">
                  <TD>
                    <Badge tone={RUN_TONE[run.status]}>{run.status}</Badge>
                  </TD>
                  <TD>
                    <span className="font-medium">{run.ruleName}</span>
                    {run.test && <span className="ml-1 text-xs text-muted-2">{t("auto.logs.test")}</span>}
                  </TD>
                  <TD>
                    <span className="text-xs text-muted">{run.trigger}</span>
                  </TD>
                  <TD>
                    <span className="tabular-nums">{run.steps.length}</span>
                  </TD>
                  <TD>
                    <span className="tabular-nums">{run.durationMs} ms</span>
                  </TD>
                  <TD>
                    <span className="text-xs text-muted">{new Date(run.finishedAt).toLocaleString()}</span>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={t("auto.logs.trace")}>
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge tone={RUN_TONE[selected.status]}>{selected.status}</Badge>
              <span className="text-sm font-semibold">{selected.ruleName}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Meta label={t("auto.logs.meta.trigger")} value={selected.trigger} />
              <Meta label={t("auto.logs.meta.duration")} value={`${selected.durationMs} ms`} />
              <Meta label={t("auto.logs.meta.started")} value={new Date(selected.startedAt).toLocaleString()} />
              <Meta label={t("auto.logs.meta.finished")} value={new Date(selected.finishedAt).toLocaleString()} />
            </div>

            {selected.error && (
              <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{selected.error}</p>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-2">{t("auto.logs.stepTrace")}</p>
              <ol className="space-y-2 border-l border-border pl-4">
                {selected.steps.map((step, i) => (
                  <li key={i} className="animate-rise relative text-sm" style={{ animationDelay: `${i * 70}ms` }}>
                    <span
                      className={cn(
                        "absolute -left-[1.36rem] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-surface",
                        step.status === "ok" ? "bg-success" : step.status === "failed" ? "bg-danger animate-soft-pulse" : "bg-muted-2",
                      )}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{step.name}</span>
                      <span className={cn("text-xs tabular-nums", STEP_TONE[step.status])}>
                        {step.status} · {step.ms}ms
                      </span>
                    </div>
                    {step.output && <p className="text-xs text-muted">{step.output}</p>}
                    {step.error && <p className="text-xs text-danger">{step.error}</p>}
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Snapshot label={t("auto.logs.inputSnap")} data={selected.input} />
              <Snapshot label={t("auto.logs.outputSnap")} data={selected.output} />
            </div>

            <Button variant="primary" loading={retrying} onClick={() => retry(selected)} className="w-full">
              <Icon name="recurring" className="h-3.5 w-3.5" /> {t("auto.logs.rerun")}
            </Button>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-2">{label}</div>
      <div className="truncate font-medium">{value}</div>
    </div>
  );
}

function Snapshot({ label, data }: { label: string; data: Record<string, unknown> }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-2">{label}</p>
      <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-surface-2/40 p-2 text-[11px] leading-relaxed text-muted">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
