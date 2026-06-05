"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/ui/icon";
import { Input, Select, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n/context";
import type { AutomationSettings, SystemSettingValue, SystemSettingsResponse } from "./types";

function Toggle({
  checked,
  onChange,
  title,
  description,
  icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/40 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
    >
      <span className="flex items-start gap-2.5">
        <span className={cn("mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg", checked ? "bg-primary/12 text-primary" : "bg-surface-2 text-muted-2")}>
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-muted">{description}</span>
        </span>
      </span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-border-strong")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-[1.125rem]" : "left-0.5")} />
      </span>
    </button>
  );
}

export function SettingsTab() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<AutomationSettings>(`/automation/settings`).then(setSettings).catch(() => undefined);
  }, []);

  function patch(p: Partial<AutomationSettings>) {
    setSettings((s) => (s ? { ...s, ...p } : s));
  }

  async function save() {
    if (!settings) return;
    setBusy(true);
    try {
      await apiFetch(`/automation/settings`, { method: "PATCH", body: settings });
      toast.success(t("auto.toast.settingsSaved"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted">
        <Spinner /> {t("auto.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("auto.set.notif")} />
          <CardBody className="space-y-2">
            <Toggle icon="bell" title={t("auto.set.realtime")} description={t("auto.set.realtimeDesc")} checked={settings.realtimeAlerts} onChange={(v) => patch({ realtimeAlerts: v })} />
            <Toggle icon="shield" title={t("auto.set.failure")} description={t("auto.set.failureDesc")} checked={settings.failureAlerts} onChange={(v) => patch({ failureAlerts: v })} />
            <Toggle icon="activity" title={t("auto.set.sla")} description={t("auto.set.slaDesc")} checked={settings.slaAlerts} onChange={(v) => patch({ slaAlerts: v })} />
            <label className="flex items-center justify-between gap-2 px-1 text-sm text-muted">
              {t("auto.set.slaWindow")}
              <Input type="number" value={settings.slaMinutes} onChange={(e) => patch({ slaMinutes: Number(e.target.value) })} className="h-8 w-24 text-xs" />
            </label>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("auto.set.time")} />
          <CardBody className="space-y-2">
            <Toggle icon="calendar" title={t("auto.set.bizHours")} description={t("auto.set.bizHoursDesc")} checked={settings.businessHoursOnly} onChange={(v) => patch({ businessHoursOnly: v })} />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">
                {t("auto.set.start")}
                <Input value={settings.businessStart} onChange={(e) => patch({ businessStart: e.target.value })} className="mt-1 h-8 text-xs" />
              </label>
              <label className="text-xs text-muted">
                {t("auto.set.end")}
                <Input value={settings.businessEnd} onChange={(e) => patch({ businessEnd: e.target.value })} className="mt-1 h-8 text-xs" />
              </label>
            </div>
            <label className="block text-xs text-muted">
              {t("auto.set.timezone")}
              <Select value={settings.timezone} onChange={(e) => patch({ timezone: e.target.value })} className="mt-1 h-8 text-xs">
                {["UTC", "Europe/Istanbul", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Dubai"].map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </label>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("auto.set.queue")} />
          <CardBody className="space-y-3">
            <label className="flex items-center justify-between gap-2 text-sm text-muted">
              {t("auto.set.maxRetries")}
              <Input type="number" value={settings.maxRetries} onChange={(e) => patch({ maxRetries: Number(e.target.value) })} className="h-8 w-24 text-xs" />
            </label>
            <label className="flex items-center justify-between gap-2 text-sm text-muted">
              {t("auto.set.rateLimit")}
              <Input type="number" value={settings.rateLimitPerMin} onChange={(e) => patch({ rateLimitPerMin: Number(e.target.value) })} className="h-8 w-24 text-xs" />
            </label>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Icon name="activity" className="h-4 w-4 text-primary" /> {t("auto.set.ai")}
              </span>
            }
          />
          <CardBody className="space-y-2">
            <Toggle icon="lead" title={t("auto.set.aiLead")} description={t("auto.set.aiLeadDesc")} checked={settings.aiLeadScoring} onChange={(v) => patch({ aiLeadScoring: v })} />
            <Toggle icon="target" title={t("auto.set.aiNba")} description={t("auto.set.aiNbaDesc")} checked={settings.aiNextBestAction} onChange={(v) => patch({ aiNextBestAction: v })} />
            <Toggle icon="users" title={t("auto.set.aiSmart")} description={t("auto.set.aiSmartDesc")} checked={settings.aiSmartAssignment} onChange={(v) => patch({ aiSmartAssignment: v })} />
            <Toggle icon="trending" title={t("auto.set.aiPred")} description={t("auto.set.aiPredDesc")} checked={settings.aiPredictive} onChange={(v) => patch({ aiPredictive: v })} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={t("auto.set.gov")} />
        <CardBody className="space-y-2 text-sm text-muted">
          <p className="flex items-center gap-2">
            <Icon name="shield" className="h-3.5 w-3.5 text-success" /> {t("auto.set.gov1")}
          </p>
          <p className="flex items-center gap-2">
            <Icon name="check" className="h-3.5 w-3.5 text-success" /> {t("auto.set.gov2")}
          </p>
          <p className="flex items-center gap-2">
            <Icon name="activity" className="h-3.5 w-3.5 text-success" /> {t("auto.set.gov3")}
          </p>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" loading={busy} onClick={save}>
          {t("auto.set.save")}
        </Button>
      </div>

      <SystemSettingsCard />
    </div>
  );
}

function SystemSettingsCard() {
  const { t } = useI18n();
  const [data, setData] = useState<SystemSettingsResponse | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await apiFetch<SystemSettingsResponse>(`/system/settings`);
      setData(r);
      setEdits({});
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const valueOf = (s: SystemSettingValue) => (s.key in edits ? edits[s.key] : s.value);
  const setVal = (key: string, v: string) => setEdits((e) => ({ ...e, [key]: v }));

  async function save() {
    if (Object.keys(edits).length === 0) {
      toast.message(t("auto.toast.sysSaved"));
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/system/settings`, { method: "PATCH", body: edits });
      toast.success(t("auto.toast.sysSaved"));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <Card>
        <CardHeader title={t("auto.sys.title")} />
        <CardBody>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> {t("auto.loading")}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Icon name="settings" className="h-4 w-4 text-primary" /> {t("auto.sys.title")}
          </span>
        }
        action={
          <Button variant="primary" size="sm" loading={busy} onClick={save}>
            {t("auto.sys.save")}
          </Button>
        }
      />
      <CardBody className="space-y-4">
        <p className="text-xs text-muted">{t("auto.sys.desc")}</p>

        {data.groups.map((group) => {
          const items = data.settings.filter((s) => s.group === group);
          if (items.length === 0) return null;
          const gk = `auto.sys.group.${group}`;
          const gl = t(gk);
          return (
            <div key={group}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-2">{gl === gk ? group : gl}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((s) => (
                  <SystemSettingRow key={s.key} setting={s} value={valueOf(s)} onChange={(v) => setVal(s.key, v)} />
                ))}
              </div>
            </div>
          );
        })}

        <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          <Icon name="shield" className="mr-1 inline h-3.5 w-3.5" /> {t("auto.sys.dbNote")}
        </p>
      </CardBody>
    </Card>
  );
}

function SystemSettingRow({
  setting,
  value,
  onChange,
}: {
  setting: SystemSettingValue;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useI18n();
  const flag = setting.readonly ? t("auto.sys.readonly") : setting.restart ? t("auto.sys.restart") : null;

  const control = () => {
    if (setting.type === "boolean") {
      const on = value === "true";
      return (
        <button
          type="button"
          disabled={setting.readonly}
          onClick={() => onChange(on ? "false" : "true")}
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full transition-colors",
            on ? "bg-primary" : "bg-border-strong",
            setting.readonly && "opacity-50",
          )}
        >
          <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", on ? "left-[1.125rem]" : "left-0.5")} />
        </button>
      );
    }
    if (setting.type === "select") {
      return (
        <Select value={value} disabled={setting.readonly} onChange={(e) => onChange(e.target.value)} className="h-8 text-xs">
          {setting.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      );
    }
    return (
      <Input
        type={setting.secret ? "password" : setting.type === "number" ? "number" : "text"}
        value={value}
        disabled={setting.readonly}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs"
      />
    );
  };

  return (
    <div className={cn("rounded-xl border border-border bg-surface-2/40 p-2.5", setting.readonly && "opacity-80")}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <Label>
          <span className="flex items-center gap-1.5">
            {setting.label}
            <code className="text-[10px] text-muted-2">{setting.key}</code>
          </span>
        </Label>
        {flag && (
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", setting.readonly ? "bg-surface-2 text-muted-2" : "bg-warning/15 text-warning")}>
            {flag}
          </span>
        )}
      </div>
      {setting.type === "boolean" ? <div className="flex items-center">{control()}</div> : control()}
      {setting.help && <p className="mt-0.5 text-[11px] text-muted-2">{setting.help}</p>}
    </div>
  );
}
