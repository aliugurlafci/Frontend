"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";
import { DropdownMenu, MenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n/context";
import { AutomationBuilder } from "./builder";
import type { AutomationCatalog, AutomationRule, AutomationStatus, CatalogUser } from "./types";
import { ACTION_ICON, STATUS_TONE, TRIGGER_ICON } from "./types";

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

  async function load() {
    const r = await apiFetch<{ rules: AutomationRule[] }>(`/automations`).catch(() => ({ rules: [] }));
    setRules(r.rules);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function setStatus(rule: AutomationRule, status: AutomationStatus) {
    try {
      await apiFetch(`/automations/${rule.id}/status`, { method: "POST", body: { status } });
      toast.success(t("auto.toast.statusChanged", { name: rule.name, status: t(`auto.status.${status}`) }));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function runTest(rule: AutomationRule) {
    try {
      const run = await apiFetch<{ status: string; steps: unknown[] }>(`/automations/${rule.id}/run`, { method: "POST", body: {} });
      toast.success(t("auto.toast.testRun", { status: run.status, n: String(run.steps.length) }));
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
      <div className="flex items-center gap-2 p-8 text-sm text-muted">
        <Spinner /> {t("auto.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{t("auto.count", { n: String(rules.length) })}</p>
        <Button variant="primary" size="sm" onClick={() => setBuilder({ rule: null })}>
          <Icon name="plus" className="h-3.5 w-3.5" /> {t("auto.new")}
        </Button>
      </div>

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
          {rules.map((rule) => (
            <Card key={rule.id} className="overflow-hidden">
              <div className="flex items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
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
                      <MenuItem onClick={() => { runTest(rule); close(); }}>
                        <Icon name="activity" className="h-3.5 w-3.5" /> {t("auto.menu.test")}
                      </MenuItem>
                      <MenuItem onClick={() => { duplicate(rule); close(); }}>
                        <Icon name="plus" className="h-3.5 w-3.5" /> {t("auto.menu.duplicate")}
                      </MenuItem>
                      {rule.status !== "active" ? (
                        <MenuItem onClick={() => { setStatus(rule, "active"); close(); }}>
                          <Icon name="send" className="h-3.5 w-3.5" /> {t("auto.menu.activate")}
                        </MenuItem>
                      ) : (
                        <MenuItem onClick={() => { setStatus(rule, "paused"); close(); }}>
                          <Icon name="lock" className="h-3.5 w-3.5" /> {t("auto.menu.pause")}
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
                {rule.actions.slice(0, 4).map((a) => (
                  <span key={a.id} className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary" title={a.type}>
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
            </Card>
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
    </div>
  );
}
