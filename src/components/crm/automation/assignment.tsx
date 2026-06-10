"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input, Select, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n/context";
import type { AssignmentRule, AssignmentStrategy, AutomationCatalog, CatalogUser } from "./types";
import { Reveal, Skeleton } from "./anim";

const BLANK: AssignmentRule = {
  id: "",
  name: "",
  entity: "account",
  strategy: "round_robin",
  pool: [],
  enabled: true,
  cursor: 0,
};

export function AssignmentTab({ catalog, users }: { catalog: AutomationCatalog; users: CatalogUser[] }) {
  const { t } = useI18n();
  const [rules, setRules] = useState<AssignmentRule[] | null>(null);
  const [draft, setDraft] = useState<AssignmentRule | null>(null);

  async function load() {
    const r = await apiFetch<{ rules: AssignmentRule[] }>(`/automation/assignment`).catch(() => ({ rules: [] }));
    setRules(r.rules);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error(t("auto.toast.asgNameRequired"));
      return;
    }
    try {
      await apiFetch(`/automation/assignment`, { method: "POST", body: draft });
      toast.success(t("auto.toast.asgSaved"));
      setDraft(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(id: string) {
    try {
      await apiFetch(`/automation/assignment/${id}`, { method: "DELETE" });
      toast.success(t("auto.toast.asgRemoved"));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function toggle(rule: AssignmentRule) {
    try {
      await apiFetch(`/automation/assignment`, { method: "POST", body: { ...rule, enabled: !rule.enabled } });
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const userName = (id: string) => users.find((u) => u.id === id)?.displayName ?? id;

  if (!rules) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{t("auto.asg.intro")}</p>
        <Button variant="primary" size="sm" onClick={() => setDraft({ ...BLANK })}>
          <Icon name="plus" className="h-3.5 w-3.5" /> {t("auto.asg.new")}
        </Button>
      </div>

      {rules.length === 0 && !draft ? (
        <Card>
          <EmptyState icon="users" title={t("auto.asg.empty.title")} description={t("auto.asg.empty.desc")} />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rules.map((rule, idx) => (
            <Reveal key={rule.id} i={idx} className="h-full">
            <Card className="h-full p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={rule.enabled ? "success" : "neutral"}>{rule.enabled ? t("auto.asg.on") : t("auto.asg.off")}</Badge>
                    <h3 className="text-sm font-semibold">{rule.name}</h3>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {catalog.entities.find((e) => e.name === rule.entity)?.label ?? rule.entity} ·{" "}
                    {t(`auto.st.${rule.strategy}`)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggle(rule)} aria-label={t("auto.menu.activate")} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground">
                    <Icon name={rule.enabled ? "lock" : "send"} className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDraft(rule)} aria-label={t("auto.menu.edit")} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground">
                    <Icon name="edit" className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(rule.id)} aria-label={t("auto.menu.delete")} className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {rule.pool.length === 0 && <span className="text-xs text-muted-2">{t("auto.asg.emptyPool")}</span>}
                {rule.pool.map((id, pi) => (
                  <span key={id} className="animate-zoom-in" style={{ animationDelay: `${pi * 50}ms` }}>
                    <Badge tone="neutral">{userName(id)}</Badge>
                  </span>
                ))}
              </div>
            </Card>
            </Reveal>
          ))}
        </div>
      )}

      {draft && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">{draft.id ? t("auto.asg.edit") : t("auto.asg.newRule")}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="asg-name" required>{t("auto.asg.name")}</Label>
              <Input id="asg-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t("auto.asg.namePh")} />
            </div>
            <div>
              <Label htmlFor="asg-entity">{t("auto.asg.entity")}</Label>
              <Select id="asg-entity" value={draft.entity} onChange={(e) => setDraft({ ...draft, entity: e.target.value })}>
                {catalog.entities.map((en) => (
                  <option key={en.name} value={en.name}>
                    {en.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="asg-strategy">{t("auto.asg.strategy")}</Label>
              <Select id="asg-strategy" value={draft.strategy} onChange={(e) => setDraft({ ...draft, strategy: e.target.value as AssignmentStrategy })}>
                {catalog.assignmentStrategies.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(`auto.st.${s.value}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <p className="mb-1.5 mt-3 text-xs font-medium text-muted">
            {catalog.assignmentStrategies.find((s) => s.value === draft.strategy)?.description}
          </p>
          <Label>{t("auto.asg.pool")}</Label>
          <div className="flex flex-wrap gap-1.5">
            {users.map((u) => {
              const on = draft.pool.includes(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      pool: on ? draft.pool.filter((p) => p !== u.id) : [...draft.pool, u.id],
                    })
                  }
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs transition-all",
                    on ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface/50 text-muted hover:bg-surface-2",
                  )}
                >
                  {u.displayName}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={save}>
              {t("auto.asg.save")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
