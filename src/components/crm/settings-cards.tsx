"use client";

/**
 * Redesigned Settings cards — interactive pieces (copy-to-clipboard fields and the
 * searchable, grouped Metadata explorer). The static cards (Account summary,
 * Feature flags, Import/Export, Release timeline) are rendered by the server page;
 * these client components add the interactivity the server can't.
 */
import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n/context";
import { RepublishButton } from "./settings-admin";

/** A labelled value with a one-click copy affordance. */
export function CopyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <button
      onClick={copy}
      aria-label={`${label}: ${value} — ${t("common.copy")}`}
      title={copied ? t("common.copied") : t("common.copy")}
      className="group flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2/70"
    >
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={cn("truncate text-sm", mono && "font-mono text-xs")}>{value}</span>
        <Icon
          name={copied ? "checkmark" : "copy"}
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-opacity",
            copied ? "text-success opacity-100" : "text-muted-2 opacity-0 group-hover:opacity-100",
          )}
        />
      </span>
      <span aria-live="polite" className="sr-only">
        {copied ? t("common.copied") : ""}
      </span>
    </button>
  );
}

export interface EntitySummary {
  name: string;
  pluralLabel: string;
  group?: string;
  icon?: string;
  fieldCount: number;
  system: boolean;
}

/** Order groups the way the nav does, then anything else alphabetically. */
const GROUP_ORDER = [
  "crm", "sales", "inventory", "purchasing", "accounting", "finance",
  "branches", "people", "projects", "marketing", "support", "comms", "admin",
];

function StatChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2/50 px-3 py-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-hover text-primary-foreground">
        <Icon name={icon} className="h-3.5 w-3.5" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold tabular-nums">{value}</span>
        <span className="block text-[10px] uppercase tracking-wide text-muted-2">{label}</span>
      </span>
    </div>
  );
}

/** Searchable, grouped explorer of the published entity model. */
export function MetadataExplorer({
  version,
  entities,
  isAdmin,
}: {
  version: number;
  entities: EntitySummary[];
  isAdmin: boolean;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");

  const totalFields = useMemo(() => entities.reduce((n, e) => n + e.fieldCount, 0), [entities]);
  const customCount = useMemo(() => entities.filter((e) => !e.system).length, [entities]);

  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = entities.filter(
      (e) => !needle || e.pluralLabel.toLowerCase().includes(needle) || e.name.toLowerCase().includes(needle),
    );
    const byGroup = new Map<string, EntitySummary[]>();
    for (const e of match) {
      const g = e.group ?? "other";
      const list = byGroup.get(g) ?? [];
      list.push(e);
      byGroup.set(g, list);
    }
    return [...byGroup.entries()].sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a[0]);
      const ib = GROUP_ORDER.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a[0].localeCompare(b[0]);
    });
  }, [entities, q]);

  const groupLabel = (g: string) => (t(`group.${g}`) === `group.${g}` ? g : t(`group.${g}`));

  return (
    <Card>
      <CardHeader title={t("settings.metadata")} action={isAdmin ? <RepublishButton /> : undefined} />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatChip icon="database" label={t("settings.publishedVersion")} value={`v${version}`} />
          <StatChip icon="folder" label={t("settings.metaEntities")} value={String(entities.length)} />
          <StatChip icon="file" label={t("settings.metaFields")} value={String(totalFields)} />
          <StatChip icon="edit" label={t("settings.metaCustom")} value={String(customCount)} />
        </div>

        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("settings.metaSearch")}
            aria-label={t("settings.metaSearch")}
            className="pl-8 text-sm"
          />
        </div>

        {grouped.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t("settings.metaNoMatch")}</p>
        ) : (
          <div className="max-h-[26rem] space-y-4 overflow-y-auto pr-1">
            {grouped.map(([g, list]) => (
              <div key={g}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">{groupLabel(g)}</span>
                  <span className="text-[11px] text-muted-2">·</span>
                  <span className="text-[11px] text-muted-2">{list.length}</span>
                </div>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {list.map((e) => (
                    <li
                      key={e.name}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-2.5 py-1.5 transition-colors hover:border-primary/30 hover:bg-surface-2/60"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                          <Icon name={e.icon ?? "folder"} className="h-3.5 w-3.5" />
                        </span>
                        <span className="truncate text-sm font-medium">{e.pluralLabel}</span>
                        {e.system && <Badge tone="neutral">{t("settings.metaSystem")}</Badge>}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        {t("settings.fieldsCount", { count: String(e.fieldCount) })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
