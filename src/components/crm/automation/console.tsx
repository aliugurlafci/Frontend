"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Tabs } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/context";
import type { AutomationCatalog, CatalogUser } from "./types";
import { OverviewTab } from "./overview";
import { RulesTab } from "./rules";
import { LogsTab } from "./logs";
import { QueueTab } from "./queue";
import { AssignmentTab } from "./assignment";
import { IntegrationsTab } from "./integrations";
import { SettingsTab } from "./settings";

export function AutomationConsole() {
  const { t } = useI18n();
  const [tab, setTab] = useState("overview");
  const [catalog, setCatalog] = useState<AutomationCatalog | null>(null);
  const [users, setUsers] = useState<CatalogUser[]>([]);

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-primary-foreground shadow-[0_6px_18px_-6px_var(--primary)]">
              <Icon name="recurring" className="h-5 w-5" />
            </span>
            {t("auto.title")}
          </h1>
          <p className="mt-0.5 text-sm text-muted">{t("auto.subtitle")}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Tabs items={TABS} value={tab} onChange={setTab} />
      </div>

      {!catalog && tab !== "overview" && tab !== "logs" && tab !== "queue" ? (
        <div className="flex items-center gap-2 p-8 text-sm text-muted">
          <Spinner /> {t("auto.loadingCatalog")}
        </div>
      ) : (
        <div className="animate-fade">
          {tab === "overview" && <OverviewTab onJump={setTab} />}
          {tab === "automations" && catalog && <RulesTab catalog={catalog} users={users} />}
          {tab === "logs" && <LogsTab />}
          {tab === "queue" && <QueueTab />}
          {tab === "assignment" && catalog && <AssignmentTab catalog={catalog} users={users} />}
          {tab === "integrations" && <IntegrationsTab />}
          {tab === "settings" && <SettingsTab />}
        </div>
      )}
    </div>
  );
}
