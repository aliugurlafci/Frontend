"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";
import { DropdownMenu, MenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n/context";
import { AutomationBuilder } from "./builder";
import { RunRuleDialog } from "./run-rule-dialog";
import type { AutomationCatalog, AutomationRule, AutomationStatus, CatalogUser, LiveActivity, QueueDrainResult } from "./types";
import { ACTION_ICON, STATUS_TONE, TRIGGER_ICON } from "./types";
import { Reveal, AnimatedBar, Skeleton } from "./anim";

type Translate = (key: string, vars?: Record<string, string>) => string;

function triggerLabel(rule: AutomationRule, catalog: AutomationCatalog, t: Translate): string {
  const tr = rule.trigger;
  const entity = catalog.entities.find((e) => e.name === tr.entity)?.label ?? tr.entity ?? "";
  if (tr.kind === "event") return `${entity} ${t(`auto.ev.${tr.event ?? "any"}`).toLowerCase()}`;
  if (tr.kind === "schedule") return `${t("auto.tk.schedule")} · ${tr.schedule}`;
  if (tr.kind === "inactivity") return `${entity} · ${tr.inactivityDays}d`;
  return `${t("auto.tk.webhook")} · ${tr.webhookEvent ?? "any"}`;
}

export function RulesTab({ catalog, users }: { catalog: AutomationCatalog; users: CatalogUser[] }) {
  const { t } = useI18n();
  const [rules, setRules] = useState<AutomationRule[] | null>(null);
  const [builder, setBuilder] = useState<{ rule: AutomationRule | null } | null>(null);
  const [runDialog, setRunDialog] = useState<AutomationRule | null>(null);
  const [live, setLive] = useState<LiveActivity>({ running: [], recent: [] });
  const [runningNow, setRunningNow] = useState(false);

  async function load() {
    const r = await apiFetch<{ rules: AutomationRule[] }>(`/automations`).catch(() => ({ rules: [] }));
    setRules(r.rules);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  // Poll live activity (which rules are running right now + recent runs) while
  // this tab is open, so cards can show a live "running" indicator.
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await apiFetch<LiveActivity>(`/automation/live`);
        if (alive) setLive(r);
      } catch {
        /* ignore transient errors */
      }
    };
    poll();
    const id = setInterval(poll, 1800);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const isRunning = (id: string) => live.running.includes(id);

  /** Queue every active scheduled automation and drain the queue to completion. */
  async function runNow() {
    setRunningNow(true);
    try {
      const r = await apiFetch<QueueDrainResult & { queued: number }>(`/automation/run-now`, { method: "POST", body: {} });
      toast.success(t("auto.runNowDone", { queued: String(r.queued), processed: String(r.processed), remaining: String(r.remaining) }));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunningNow(false);
    }
  }

  async function setStatus(rule: AutomationRule, status: AutomationStatus) {
    try {
      await apiFetch(`/automations/${rule.id}/status`, { method: "POST", body: { status } });
      toast.success(t("auto.toast.statusChanged", { name: rule.name, status: t(`auto.status.${status}`) }));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  /** Run the rule on demand for real (performs its actions against live data).
   *  Event rules need a record to interpolate {{record.*}} against, so open the
   *  record picker; schedule/inactivity/webhook rules have no record and run
   *  straight away. */
  async function runRule(rule: AutomationRule) {
    if (rule.trigger.kind === "event" && rule.trigger.entity) {
      setRunDialog(rule);
      return;
    }
    try {
      const run = await apiFetch<{ status: string; steps: unknown[] }>(`/automations/${rule.id}/run`, {
        method: "POST",
        body: { test: false },
      });
      if (run.status === "failed") toast.error(t("auto.toast.runFailed", { name: rule.name }));
      else toast.success(t("auto.toast.run", { status: t(`auto.status.${run.status}`), n: String(run.steps.length) }));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(rule: AutomationRule) {
    try {
      await apiFetch(`/automations/${rule.id}`, { method: "DELETE" });
      toast.success(t("auto.toast.deleted"));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function duplicate(rule: AutomationRule) {
    try {
      await apiFetch(`/automations`, {
        method: "POST",
        body: {
          name: `${rule.name} (copy)`,
          description: rule.description,
          trigger: rule.trigger,
          conditions: rule.conditions,
          actions: rule.actions,
          status: "draft",
          tags: rule.tags,
        },
      });
      toast.success(t("auto.toast.duplicated"));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!rules) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{t("auto.count", { n: String(rules.length) })}</p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" loading={runningNow} onClick={runNow} title={t("auto.runNowHint")}>
            <Icon name="activity" className="h-3.5 w-3.5" /> {t("auto.runNow")}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setBuilder({ rule: null })}>
            <Icon name="plus" className="h-3.5 w-3.5" /> {t("auto.new")}
          </Button>
        </div>
      </div>

      {/* Live activity strip — what's running now / what just ran. */}
      {(live.running.length > 0 || live.recent.length > 0) && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/40 px-3 py-1.5 text-xs">
          {live.running.length > 0 ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="font-medium text-foreground">{t("auto.live.running", { n: String(live.running.length) })}</span>
            </>
          ) : (
            <>
              <Icon name="activity" className="h-3.5 w-3.5 text-muted-2" />
              <span className="text-muted">
                {t("auto.live.lastRan", { name: live.recent[0]?.ruleName ?? "—" })}
                <span className="ml-1 text-muted-2">· {live.recent[0] ? new Date(live.recent[0].at).toLocaleTimeString() : ""}</span>
              </span>
            </>
          )}
        </div>
      )}

      {rules.length === 0 ? (
        <Card>
          <EmptyState
            icon="recurring"
            title={t("auto.empty.title")}
            description={t("auto.empty.desc")}
            action={
              <Button variant="primary" size="sm" onClick={() => setBuilder({ rule: null })}>
                <Icon name="plus" className="h-3.5 w-3.5" /> {t("auto.new")}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rules.map((rule, idx) => (
            <Reveal key={rule.id} i={idx} className="h-full">
            <Card
              className={cn(
                "group h-full overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]",
                isRunning(rule.id) && "ring-2 ring-primary/50 shadow-[var(--shadow-md)]",
              )}
            >
              <div className="flex items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {isRunning(rule.id) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                        </span>
                        {t("auto.running")}
                      </span>
                    )}
                    <Badge tone={STATUS_TONE[rule.status]}>{t(`auto.status.${rule.status}`)}</Badge>
                    {rule.requiresApproval && (
                      <span title={rule.approvedBy ? "Approved" : "Awaiting approval"}>
                        <Icon name="shield" className={cn("h-3.5 w-3.5", rule.approvedBy ? "text-success" : "text-warning")} />
                      </span>
                    )}
                    <h3 className="truncate text-sm font-semibold">{rule.name}</h3>
                  </div>
                  {rule.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{rule.description}</p>}
                </div>
                <DropdownMenu
                  align="end"
                  trigger={({ toggle }) => (
                    <button onClick={toggle} aria-label="Actions" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground">
                      <Icon name="settings" className="h-4 w-4" />
                    </button>
                  )}
                >
                  {({ close }) => (
                    <>
                      <MenuItem onClick={() => { setBuilder({ rule }); close(); }}>
                        <Icon name="edit" className="h-3.5 w-3.5" /> {t("auto.menu.edit")}
                      </MenuItem>
                      <MenuItem onClick={() => { runRule(rule); close(); }}>
                        <Icon name="zap" className="h-3.5 w-3.5" /> {t("auto.menu.run")}
                      </MenuItem>
                      <MenuItem onClick={() => { duplicate(rule); close(); }}>
                        <Icon name="plus" className="h-3.5 w-3.5" /> {t("auto.menu.duplicate")}
                      </MenuItem>
                      {rule.status !== "active" ? (
                        <MenuItem onClick={() => { setStatus(rule, "active"); close(); }}>
                          <Icon name="play" className="h-3.5 w-3.5" /> {t("auto.menu.activate")}
                        </MenuItem>
                      ) : (
                        <MenuItem onClick={() => { setStatus(rule, "paused"); close(); }}>
                          <Icon name="pause" className="h-3.5 w-3.5" /> {t("auto.menu.pause")}
                        </MenuItem>
                      )}
                      <MenuItem danger onClick={() => { remove(rule); close(); }}>
                        <Icon name="trash" className="h-3.5 w-3.5" /> {t("auto.menu.delete")}
                      </MenuItem>
                    </>
                  )}
                </DropdownMenu>
              </div>

              {/* flow summary */}
              <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-4 py-2.5 text-xs">
                <span className="flex items-center gap-1 rounded-lg bg-surface-2/60 px-2 py-1 font-medium">
                  <Icon name={TRIGGER_ICON[rule.trigger.kind]} className="h-3 w-3 text-primary" /> {triggerLabel(rule, catalog, t)}
                </span>
                {rule.conditions.children.length > 0 && (
                  <>
                    <Icon name="chevronRight" className="h-3 w-3 text-muted-2" />
                    <span className="flex items-center gap-1 rounded-lg bg-surface-2/60 px-2 py-1 text-muted">
                      <Icon name="filter" className="h-3 w-3" /> {t("auto.conditions.count", { n: String(rule.conditions.children.length) })}
                    </span>
                  </>
                )}
                <Icon name="chevronRight" className="h-3 w-3 text-muted-2" />
                {rule.actions.slice(0, 4).map((a, ai) => (
                  <span
                    key={a.id}
                    style={{ animationDelay: `${ai * 70}ms` }}
                    className="animate-zoom-in flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform hover:scale-110"
                    title={a.type}
                  >
                    <Icon name={ACTION_ICON[a.type]} className="h-3 w-3" />
                  </span>
                ))}
                {rule.actions.length > 4 && <span className="text-muted-2">+{rule.actions.length - 4}</span>}
              </div>

              {/* stats footer */}
              <div className="grid grid-cols-3 divide-x divide-border border-t border-border text-center text-xs">
                <div className="px-2 py-2">
                  <div className="font-semibold tabular-nums">{rule.stats.runs}</div>
                  <div className="text-muted-2">{t("auto.runsLabel")}</div>
                </div>
                <div className="px-2 py-2">
                  <div className="font-semibold tabular-nums">
                    {rule.stats.runs ? Math.round((rule.stats.success / rule.stats.runs) * 100) : 0}%
                  </div>
                  <div className="text-muted-2">{t("auto.successLabel")}</div>
                </div>
                <div className="px-2 py-2">
                  <div className="font-semibold tabular-nums">{rule.stats.avgMs}ms</div>
                  <div className="text-muted-2">{t("auto.avgLabel")}</div>
                </div>
              </div>
              <AnimatedBar
                pct={rule.stats.runs ? Math.round((rule.stats.success / rule.stats.runs) * 100) : 0}
                className="h-1 rounded-none bg-surface-2/60"
              />
            </Card>
            </Reveal>
          ))}
        </div>
      )}

      {builder && (
        <AutomationBuilder
          rule={builder.rule}
          catalog={catalog}
          users={users}
          onClose={() => setBuilder(null)}
          onSaved={() => {
            setBuilder(null);
            load();
          }}
        />
      )}

      {runDialog && (
        <RunRuleDialog
          rule={runDialog}
          catalog={catalog}
          onClose={() => setRunDialog(null)}
          onRan={load}
        />
      )}
    </div>
  );
}
