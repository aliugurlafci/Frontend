"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/ui/icon";
import { Input, Select, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n/context";
import { WebhookManager } from "../automation-admin";
import type {
  IntegrationConfig,
  IntegrationProviderDef,
  IntegrationState,
  IntegrationsResponse,
} from "./types";

export function IntegrationsTab() {
  const { t } = useI18n();
  const [providers, setProviders] = useState<IntegrationProviderDef[]>([]);
  const [states, setStates] = useState<Record<string, IntegrationState>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);

  async function load() {
    try {
      const r = await apiFetch<IntegrationsResponse>(`/automation/integrations`);
      setProviders(r.providers);
      setStates(Object.fromEntries(r.integrations.map((i) => [i.provider, i])));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const providerName = (key: string, fallback: string) => {
    const k = `auto.prov.${key}`;
    const v = t(k);
    return v === k ? fallback : v;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted">
        <Spinner /> {t("auto.loading")}
      </div>
    );
  }

  const editingDef = providers.find((p) => p.key === editing) ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t("auto.int.hub")} />
        <CardBody>
          <p className="mb-3 text-xs text-muted">{t("auto.int.hubDesc")}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((p) => {
              const st = states[p.key];
              const enabled = st?.enabled ?? false;
              return (
                <div key={p.key} className="glass glass-sheen rounded-2xl p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-secondary/10 text-primary ring-1 ring-primary/15">
                      <Icon name={p.icon} className="h-4 w-4" />
                    </span>
                    <Badge tone={enabled ? "success" : "neutral"}>
                      {enabled ? t("auto.int.connected") : t("auto.int.notSet")}
                    </Badge>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">{providerName(p.key, p.name)}</h3>
                  <p className="mt-0.5 text-xs text-muted">{p.description}</p>
                  <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => setEditing(p.key)}>
                    <Icon name="settings" className="h-3.5 w-3.5" /> {t("auto.int.configure")}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("auto.int.webhooks")} />
        <CardBody>
          <WebhookManager />
        </CardBody>
      </Card>

      {editingDef && (
        <IntegrationEditor
          def={editingDef}
          state={states[editingDef.key]}
          name={providerName(editingDef.key, editingDef.name)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function IntegrationEditor({
  def,
  state,
  name,
  onClose,
  onSaved,
}: {
  def: IntegrationProviderDef;
  state: IntegrationState | undefined;
  name: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(state?.enabled ?? false);
  const [config, setConfig] = useState<IntegrationConfig>({ ...(state?.config ?? {}) });
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const set = (key: string, value: string | number | boolean) => setConfig((c) => ({ ...c, [key]: value }));
  const hasSecrets = def.fields.some((f) => f.secret);

  async function save() {
    setBusy(true);
    try {
      await apiFetch(`/automation/integrations/${def.key}`, { method: "PATCH", body: { enabled, config } });
      toast.success(t("auto.toast.intSaved", { name }));
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      // Persist first so the test reflects the current form.
      await apiFetch(`/automation/integrations/${def.key}`, { method: "PATCH", body: { enabled, config } });
      const r = await apiFetch<{ ok: boolean; message: string }>(`/automation/integrations/${def.key}/test`, { method: "POST", body: {} });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={name}
        className="glass-strong glass-sheen relative flex h-full w-full max-w-md flex-col rounded-l-2xl shadow-[var(--shadow-lg)] outline-none animate-rise"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-primary-foreground">
              <Icon name={def.icon} className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold tracking-tight">{name}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Enabled toggle */}
          <button
            onClick={() => setEnabled((v) => !v)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/40 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
          >
            <span>
              <span className="block text-sm font-medium">{t("auto.int.enabled")}</span>
              <span className="block text-xs text-muted">{t("auto.int.enabledDesc")}</span>
            </span>
            <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", enabled ? "bg-primary" : "bg-border-strong")}>
              <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", enabled ? "left-[1.125rem]" : "left-0.5")} />
            </span>
          </button>

          {/* Dynamic fields */}
          <div className="space-y-3">
            {def.fields.map((f) => {
              const value = config[f.key];
              if (f.type === "boolean") {
                const on = value === true || value === "true";
                return (
                  <label key={f.key} className="flex items-center justify-between gap-2 text-sm">
                    <span>{f.label}</span>
                    <button
                      type="button"
                      onClick={() => set(f.key, !on)}
                      aria-pressed={on}
                      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-border-strong")}
                    >
                      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", on ? "left-[1.125rem]" : "left-0.5")} />
                    </button>
                  </label>
                );
              }
              if (f.type === "select") {
                return (
                  <div key={f.key}>
                    <Label>{f.label}</Label>
                    <Select value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)}>
                      <option value="">—</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                );
              }
              return (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Input
                    type={f.type === "password" ? "password" : f.type === "number" ? "number" : "text"}
                    value={value === undefined || value === null ? "" : String(value)}
                    placeholder={f.placeholder}
                    autoComplete={f.secret ? "new-password" : undefined}
                    onChange={(e) => set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                  />
                  {f.help && <p className="mt-0.5 text-xs text-muted-2">{f.help}</p>}
                </div>
              );
            })}
          </div>

          {hasSecrets && (
            <p className="rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs text-muted">
              <Icon name="shield" className="mr-1 inline h-3.5 w-3.5" /> {t("auto.int.secretNote")}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          <Button variant="outline" loading={testing} onClick={test}>
            <Icon name="activity" className="h-3.5 w-3.5" /> {t("auto.int.test")}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" loading={busy} onClick={save}>
              {t("auto.int.save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
