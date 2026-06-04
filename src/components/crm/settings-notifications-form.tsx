"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Channel = "email" | "push" | "sms";
type Prefs = Record<string, { email: boolean; push: boolean; sms: boolean }>;
/** As stored/returned — channels may be partial/missing. */
type InitialPrefs = Record<string, { email?: boolean; push?: boolean; sms?: boolean }> | null;

const EVENTS: { key: string; label: string; email: boolean; push: boolean; sms: boolean }[] = [
  { key: "deal_won", label: "Deal won", email: true, push: true, sms: false },
  { key: "deal_stage", label: "Deal stage changed", email: true, push: false, sms: false },
  { key: "new_lead", label: "New lead assigned", email: true, push: true, sms: true },
  { key: "invoice_paid", label: "Invoice paid", email: true, push: false, sms: false },
  { key: "invoice_overdue", label: "Invoice overdue", email: true, push: true, sms: true },
  { key: "task_due", label: "Task due soon", email: false, push: true, sms: false },
  { key: "mention", label: "You were mentioned", email: true, push: true, sms: false },
  { key: "weekly_digest", label: "Weekly digest", email: true, push: false, sms: false },
];

export function NotificationsForm({ initial }: { initial: InitialPrefs }) {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const base: Prefs = {};
    for (const e of EVENTS) {
      const saved = initial?.[e.key];
      base[e.key] = {
        email: saved?.email ?? e.email,
        push: saved?.push ?? e.push,
        sms: saved?.sms ?? e.sms,
      };
    }
    return base;
  });
  const [busy, setBusy] = useState(false);

  function toggle(key: string, channel: Channel) {
    setPrefs((prev) => ({ ...prev, [key]: { ...prev[key], [channel]: !prev[key][channel] } }));
  }

  async function save() {
    setBusy(true);
    try {
      await apiFetch("/auth/profile", { method: "PATCH", body: { notificationPrefs: prefs } });
      toast.success("Preferences saved");
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader title="Events" />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="border-b border-border bg-background text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Event</th>
                  <th className="px-3 py-2 text-center font-medium">Email</th>
                  <th className="px-3 py-2 text-center font-medium">Push</th>
                  <th className="px-3 py-2 text-center font-medium">SMS</th>
                </tr>
              </thead>
              <tbody>
                {EVENTS.map((e) => (
                  <tr key={e.key} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5">{e.label}</td>
                    {(["email", "push", "sms"] as Channel[]).map((ch) => (
                      <td key={ch} className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={prefs[e.key][ch]}
                          onChange={() => toggle(e.key, ch)}
                          aria-label={`${e.label} — ${ch}`}
                          className="h-4 w-4 cursor-pointer rounded border-border accent-[var(--primary)]"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
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
