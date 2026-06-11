"use client";

/**
 * Run-rule dialog — lets the user pick which record an event automation runs
 * against, so `{{record.*}}` tokens resolve against real data (and a manual run
 * isn't stuck with an empty placeholder). Shows recent records of the trigger
 * entity, flags which ones actually populate the message recipient field(s), and
 * renders the resulting run trace inline. Only used for event/entity rules;
 * schedule/inactivity/webhook rules have no record and run directly.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils/cn";
import type { AutomationRule, AutomationCatalog, AutomationRun, RunStep } from "./types";
import { RUN_TONE } from "./types";

type Rec = Record<string, unknown>;

/** `{{record.X}}` fields used as a message recipient in any messaging action. */
function recipientFields(rule: AutomationRule): string[] {
  const out = new Set<string>();
  const MSG = new Set(["send_email", "send_sms", "send_whatsapp", "notify"]);
  const walk = (actions: AutomationRule["actions"]): void => {
    for (const a of actions) {
      if (MSG.has(a.type) && typeof a.to === "string") {
        for (const m of a.to.matchAll(/\{\{\s*record\.(\w+)\s*\}\}/g)) out.add(m[1]);
      }
      if (a.thenActions) walk(a.thenActions);
      if (a.elseActions) walk(a.elseActions);
      for (const lane of a.lanes ?? []) walk(lane);
    }
  };
  walk(rule.actions);
  return [...out];
}

function recordTitle(r: Rec): string {
  for (const k of ["name", "title", "subject", "displayName", "number", "code"]) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return `#${String(r.id ?? "")}`;
}

const STEP_TONE: Record<string, "success" | "danger" | "neutral"> = {
  ok: "success",
  failed: "danger",
  skipped: "neutral",
};

export function RunRuleDialog({
  rule,
  catalog,
  onClose,
  onRan,
}: {
  rule: AutomationRule;
  catalog: AutomationCatalog;
  onClose: () => void;
  onRan: () => void;
}) {
  const { t } = useI18n();
  const entityName = rule.trigger.entity ?? "";
  const entityDef = catalog.entities.find((e) => e.name === entityName);
  const entityLabel = entityDef?.label ?? entityName;
  const refs = useMemo(() => recipientFields(rule), [rule]);

  const [records, setRecords] = useState<Rec[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState<string | null>(null); // record id (or "__none__") in flight
  const [result, setResult] = useState<AutomationRun | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await apiFetch<{ items: Rec[] }>(`/entities/${entityName}?pageSize=50`);
        if (!alive) return;
        const items = [...r.items].sort((a, b) =>
          String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
        );
        setRecords(items);
      } catch {
        if (alive) {
          setRecords([]);
          setLoadError(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [entityName]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!records) return [];
    if (!q) return records;
    return records.filter((r) => recordTitle(r).toLowerCase().includes(q) || refs.some((f) => String(r[f] ?? "").toLowerCase().includes(q)));
  }, [records, query, refs]);

  async function run(recordId?: string) {
    setRunning(recordId ?? "__none__");
    try {
      const run = await apiFetch<AutomationRun>(`/automations/${rule.id}/run`, {
        method: "POST",
        body: recordId ? { test: false, recordId } : { test: false },
      });
      setResult(run);
      onRan();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(null);
    }
  }

  function isDeliverable(r: Rec): boolean {
    return refs.length === 0 || refs.every((f) => r[f] != null && String(r[f]).trim() !== "");
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("auto.run.title")}
        className="glass-strong glass-sheen relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl shadow-[var(--shadow-lg)] outline-none animate-rise"
      >
        {/* header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-primary-foreground">
              <Icon name="zap" className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">{rule.name}</h2>
              <p className="text-xs text-muted">{result ? t("auto.run.result") : t("auto.run.subtitle")}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label={t("common.close")} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground">
            ✕
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-5">
          {result ? (
            <RunTrace run={result} />
          ) : (
            <div className="space-y-3">
              {records === null ? (
                <p className="py-8 text-center text-sm text-muted">{t("common.loading")}</p>
              ) : filtered.length === 0 && !query ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-2/40 px-4 py-6 text-center text-sm text-muted">
                  {loadError ? t("auto.run.loadFailed") : t("auto.run.noRecords", { entity: entityLabel })}
                </div>
              ) : (
                <>
                  {records.length > 6 && (
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("common.search")} className="text-xs" />
                  )}
                  <div className="max-h-[42vh] space-y-1.5 overflow-y-auto pr-0.5">
                    {filtered.map((r) => {
                      const id = String(r.id ?? "");
                      const deliverable = isDeliverable(r);
                      return (
                        <button
                          key={id}
                          onClick={() => run(id)}
                          disabled={running !== null}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm transition-all hover:border-primary/40 hover:bg-surface-2 disabled:opacity-50",
                            running === id && "border-primary/60 ring-1 ring-primary/30",
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{recordTitle(r)}</span>
                            {refs.length > 0 && (
                              <span className="block truncate text-xs text-muted">
                                {refs.map((f) => `${f}: ${r[f] != null && String(r[f]).trim() !== "" ? String(r[f]) : "—"}`).join(" · ")}
                              </span>
                            )}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            {refs.length > 0 && (
                              <Badge tone={deliverable ? "success" : "warning"}>
                                {deliverable ? "✓" : t("auto.run.emptyField", { fields: refs.join(", ") })}
                              </Badge>
                            )}
                            {running === id ? <Icon name="recurring" className="h-4 w-4 animate-spin text-primary" /> : <Icon name="chevronRight" className="h-4 w-4 text-muted-2" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          {result ? (
            <>
              <Badge tone={RUN_TONE[result.status]}>{result.status}</Badge>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setResult(null)}>{t("auto.run.again")}</Button>
                <Button onClick={onClose}>{t("common.close")}</Button>
              </div>
            </>
          ) : (
            <>
              <span className="text-xs text-muted">{t("auto.run.withoutRecordHint")}</span>
              <Button variant="ghost" onClick={() => run()} disabled={running !== null}>
                {running === "__none__" ? <Icon name="recurring" className="h-4 w-4 animate-spin" /> : null}
                {t("auto.run.withoutRecord")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RunTrace({ run }: { run: AutomationRun }) {
  return (
    <ol className="space-y-2">
      {run.steps.map((s: RunStep, i) => (
        <li key={i} className="flex items-start gap-3 rounded-xl border border-border bg-surface px-3 py-2">
          <span
            className={cn(
              "mt-0.5 h-2 w-2 shrink-0 rounded-full",
              s.status === "ok" && "bg-success",
              s.status === "failed" && "bg-danger",
              s.status === "skipped" && "bg-muted-2",
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{s.name}</span>
              <Badge tone={STEP_TONE[s.status] ?? "neutral"}>{s.status} · {s.ms}ms</Badge>
            </div>
            {(s.output || s.error) && (
              <p className={cn("mt-0.5 break-words text-xs", s.error ? "text-danger" : "text-muted")}>{s.error ?? s.output}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
