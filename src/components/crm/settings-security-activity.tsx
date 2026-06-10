"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

interface SecurityEvent {
  id: string;
  type: string;
  ip: string | null;
  userAgent: string | null;
  at: string;
}

const ICON: Record<string, string> = {
  sign_in: "logout",
  password_changed: "lock",
  twofactor_enabled: "shield",
  twofactor_disabled: "shield",
};

/** Reads the signed-in user's recent security activity from the database. */
export function SecurityActivity() {
  const { t, locale } = useI18n();
  const [events, setEvents] = useState<SecurityEvent[] | null>(null);

  useEffect(() => {
    apiFetch<{ events: SecurityEvent[] }>("/auth/security/activity")
      .then((r) => setEvents(r.events))
      .catch(() => setEvents([]));
  }, []);

  function when(iso: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(d);
  }
  function device(ua: string | null): string {
    if (!ua) return "";
    if (/edg/i.test(ua)) return "Edge";
    if (/chrome/i.test(ua)) return "Chrome";
    if (/firefox/i.test(ua)) return "Firefox";
    if (/safari/i.test(ua)) return "Safari";
    return ua.slice(0, 40);
  }

  return (
    <Card>
      <CardHeader title={t("settings.security.activity")} />
      <CardBody className="p-0">
        {events === null ? (
          <p className="px-4 py-6 text-center text-sm text-muted">{t("common.loading")}</p>
        ) : events.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">{t("settings.security.activityEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
                  <Icon name={ICON[e.type] ?? "bell"} className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">{t(`secEvent.${e.type}`)}</span>
                  <span className="block truncate text-xs text-muted">
                    {[device(e.userAgent), e.ip].filter(Boolean).join(" · ") || t("settings.security.activityNoMeta")}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-2">{when(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
