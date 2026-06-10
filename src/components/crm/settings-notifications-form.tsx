"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

type Channel = "inapp" | "email" | "push" | "sms";
const CHANNELS: Channel[] = ["inapp", "email", "push", "sms"];

interface ChannelPrefs {
  inapp: boolean;
  email: boolean;
  push: boolean;
  sms: boolean;
}
interface Prefs {
  paused: boolean;
  channels: ChannelPrefs;
  quiet: { enabled: boolean; start: string; end: string };
  events: Record<string, ChannelPrefs>;
}

// The notification functions that actually exist in the project. Each maps to a
// real backend event; "in-app" is the bell channel the service honours today
// (email/push/sms capture intent for when those transports are wired up).
const EVENTS: { key: string; inapp: boolean; email: boolean; push: boolean; sms: boolean }[] = [
  { key: "deal_won", inapp: true, email: true, push: true, sms: false },
  { key: "quote_sent", inapp: true, email: false, push: false, sms: false },
  { key: "invoice_sent", inapp: true, email: false, push: false, sms: false },
  { key: "po_approval", inapp: true, email: true, push: true, sms: false },
  { key: "goods_received", inapp: true, email: false, push: true, sms: false },
  { key: "new_email", inapp: true, email: false, push: false, sms: false },
];

/** Accept either the new structured prefs or the legacy flat `{event:{email,push,sms}}` map. */
function normalize(initial: unknown): Prefs {
  const raw = (initial && typeof initial === "object" ? initial : {}) as Record<string, unknown>;
  const structured = raw.events && typeof raw.events === "object";
  const savedEvents = (structured ? raw.events : raw) as Record<string, Partial<ChannelPrefs>> | undefined;
  const savedChannels = (structured ? raw.channels : undefined) as Partial<ChannelPrefs> | undefined;
  const savedQuiet = (structured ? raw.quiet : undefined) as Partial<Prefs["quiet"]> | undefined;

  const events: Record<string, ChannelPrefs> = {};
  for (const e of EVENTS) {
    const s = savedEvents?.[e.key] ?? {};
    events[e.key] = {
      // legacy rows had no `inapp` → keep the on-by-default
      inapp: s.inapp ?? e.inapp,
      email: s.email ?? e.email,
      push: s.push ?? e.push,
      sms: s.sms ?? e.sms,
    };
  }
  return {
    paused: Boolean(structured && raw.paused),
    channels: {
      inapp: savedChannels?.inapp ?? true,
      email: savedChannels?.email ?? true,
      push: savedChannels?.push ?? true,
      sms: savedChannels?.sms ?? true,
    },
    quiet: {
      enabled: Boolean(savedQuiet?.enabled),
      start: savedQuiet?.start ?? "22:00",
      end: savedQuiet?.end ?? "07:00",
    },
    events,
  };
}

export function NotificationsForm({ initial }: { initial: unknown }) {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<Prefs>(() => normalize(initial));
  const [busy, setBusy] = useState(false);

  const update = (fn: (p: Prefs) => Prefs) => setPrefs((prev) => fn(structuredClone(prev)));
  const toggleEvent = (key: string, ch: Channel) =>
    update((p) => {
      p.events[key][ch] = !p.events[key][ch];
      return p;
    });
  const toggleChannel = (ch: Channel) =>
    update((p) => {
      p.channels[ch] = !p.channels[ch];
      return p;
    });

  async function save() {
    setBusy(true);
    try {
      await apiFetch("/auth/profile", { method: "PATCH", body: { notificationPrefs: prefs } });
      toast.success(t("settings.notifications.saved"));
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : t("settings.notifications.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Master controls */}
      <Card>
        <CardHeader title={t("settings.notifications.controls")} />
        <CardBody className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={prefs.paused}
              onChange={() => update((p) => ({ ...p, paused: !p.paused }))}
              className="mt-0.5 h-4 w-4 cursor-pointer rounded border-border accent-[var(--primary)]"
            />
            <span>
              <span className="block text-sm font-medium">{t("settings.notifications.pause")}</span>
              <span className="block text-xs text-muted">{t("settings.notifications.pauseDesc")}</span>
            </span>
          </label>

          <div className={cn("space-y-2", prefs.paused && "pointer-events-none opacity-50")}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-2">{t("settings.notifications.channels")}</p>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((ch) => (
                <label
                  key={ch}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
                    prefs.channels[ch] ? "border-primary bg-primary/5" : "border-border text-muted",
                  )}
                >
                  <input type="checkbox" checked={prefs.channels[ch]} onChange={() => toggleChannel(ch)} className="h-3.5 w-3.5 accent-primary" />
                  {t(`settings.notifications.ch.${ch}`)}
                </label>
              ))}
            </div>
          </div>

          <div className={cn("space-y-2", prefs.paused && "pointer-events-none opacity-50")}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.quiet.enabled}
                onChange={() => update((p) => ({ ...p, quiet: { ...p.quiet, enabled: !p.quiet.enabled } }))}
                className="h-4 w-4 cursor-pointer rounded border-border accent-[var(--primary)]"
              />
              <span className="text-sm font-medium">{t("settings.notifications.quiet")}</span>
            </label>
            <p className="text-xs text-muted">{t("settings.notifications.quietDesc")}</p>
            <div className={cn("flex items-end gap-2", !prefs.quiet.enabled && "pointer-events-none opacity-50")}>
              <div>
                <Label htmlFor="q-start">{t("settings.notifications.from")}</Label>
                <Input id="q-start" type="time" value={prefs.quiet.start} onChange={(e) => update((p) => ({ ...p, quiet: { ...p.quiet, start: e.target.value } }))} className="w-32" />
              </div>
              <div>
                <Label htmlFor="q-end">{t("settings.notifications.to")}</Label>
                <Input id="q-end" type="time" value={prefs.quiet.end} onChange={(e) => update((p) => ({ ...p, quiet: { ...p.quiet, end: e.target.value } }))} className="w-32" />
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Per-event matrix */}
      <Card>
        <CardHeader title={t("settings.notifications.events")} />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="border-b border-border bg-background text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("settings.notifications.colEvent")}</th>
                  {CHANNELS.map((ch) => (
                    <th key={ch} className={cn("px-3 py-2 text-center font-medium", !prefs.channels[ch] && "text-muted-2 line-through")}>
                      {t(`settings.notifications.ch.${ch}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={cn(prefs.paused && "opacity-50")}>
                {EVENTS.map((e) => {
                  const label = t(`settings.notifications.ev.${e.key}`);
                  return (
                    <tr key={e.key} className="border-b border-border last:border-0">
                      <td className="px-3 py-2.5">{label}</td>
                      {CHANNELS.map((ch) => (
                        <td key={ch} className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={prefs.events[e.key][ch] && prefs.channels[ch]}
                            disabled={!prefs.channels[ch] || prefs.paused}
                            onChange={() => toggleEvent(e.key, ch)}
                            aria-label={`${label} — ${ch}`}
                            className="h-4 w-4 cursor-pointer rounded border-border accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" loading={busy} onClick={save}>
          {t("common.save")}
        </Button>
      </div>
    </>
  );
}
