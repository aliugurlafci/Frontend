"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n/context";
import type { AutomationCatalog, CatalogUser } from "./types";
import { OverviewTab } from "./overview";
import { RulesTab } from "./rules";
import { LogsTab } from "./logs";
import { QueueTab } from "./queue";
import { AssignmentTab } from "./assignment";
import { IntegrationsTab } from "./integrations";
import { SettingsTab } from "./settings";
import { SkeletonCards } from "./anim";

const TAB_ICONS: Record<string, string> = {
  overview: "home",
  automations: "recurring",
  logs: "activity",
  queue: "inbox",
  assignment: "users",
  integrations: "globe",
  settings: "settings",
};

export function AutomationConsole() {
  const { t } = useI18n();
  const [tab, setTab] = useState("overview");
  const [catalog, setCatalog] = useState<AutomationCatalog | null>(null);
  const [users, setUsers] = useState<CatalogUser[]>([]);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  const TABS = [
    { value: "overview", label: t("auto.tab.overview") },
    { value: "automations", label: t("auto.tab.automations") },
    { value: "logs", label: t("auto.tab.logs") },
    { value: "queue", label: t("auto.tab.queue") },
    { value: "assignment", label: t("auto.tab.assignment") },
    { value: "integrations", label: t("auto.tab.integrations") },
    { value: "settings", label: t("auto.tab.settings") },
  ];

  useEffect(() => {
    apiFetch<{ catalog: AutomationCatalog; users: CatalogUser[] }>(`/automation/catalog`)
      .then((r) => {
        setCatalog(r.catalog);
        setUsers(r.users);
      })
      .catch(() => undefined);
  }, []);

  // Slide the active-tab pill to the selected button (re-measures on tab change,
  // label/locale change and viewport resize so it always tracks).
  useEffect(() => {
    const measure = () => {
      const el = tabRefs.current[tab];
      if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    const id = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
    };
  }, [tab, t]);

  const needsCatalog = tab === "automations" || tab === "assignment";

  return (
    <div className="space-y-5">
      {/* Hero header */}
      <div className="glass glass-sheen relative overflow-hidden rounded-2xl px-5 py-4 animate-rise">
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-gradient-to-br from-primary/25 to-secondary/20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="animate-float flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-[0_10px_28px_-8px_var(--primary)]">
              <Icon name="recurring" className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                <span className="text-gradient">{t("auto.title")}</span>
              </h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                {t("auto.subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Animated segmented tabs */}
      <div className="overflow-x-auto pb-1">
        <div className="glass relative inline-flex min-w-full gap-1 rounded-xl p-1 sm:min-w-0">
          <span
            className="absolute top-1 h-[calc(100%-0.5rem)] rounded-lg bg-gradient-to-br from-primary to-primary-hover shadow-[0_6px_18px_-8px_var(--primary)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ left: indicator.left, width: indicator.width }}
            aria-hidden
          />
          {TABS.map((tb) => {
            const active = tab === tb.value;
            return (
              <button
                key={tb.value}
                ref={(el) => {
                  tabRefs.current[tb.value] = el;
                }}
                onClick={() => setTab(tb.value)}
                className={cn(
                  "relative z-10 flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200",
                  active ? "text-primary-foreground" : "text-muted hover:text-foreground",
                )}
              >
                <Icon name={TAB_ICONS[tb.value]} className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">{tb.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content — re-keyed so each switch replays the entrance */}
      <div key={tab} className="animate-fade">
        {needsCatalog && !catalog ? (
          <SkeletonCards count={6} />
        ) : (
          <>
            {tab === "overview" && <OverviewTab onJump={setTab} />}
            {tab === "automations" && catalog && <RulesTab catalog={catalog} users={users} />}
            {tab === "logs" && <LogsTab />}
            {tab === "queue" && <QueueTab />}
            {tab === "assignment" && catalog && <AssignmentTab catalog={catalog} users={users} />}
            {tab === "integrations" && <IntegrationsTab />}
            {tab === "settings" && <SettingsTab />}
          </>
        )}
      </div>
    </div>
  );
}
