import Link from "next/link";
import { getServerContext } from "@/lib/http/server-context";
import { metadata } from "@/lib/metadata";
import { FEATURE_FLAGS, type FeatureFlag } from "@/lib/config/feature-flags";
import { settingsAccess } from "@/lib/permissions/settings-access";
import { serverApi } from "@/lib/http/server-api";
import { getT, getLocale } from "@/lib/i18n/server";
import { entityLabel } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils/cn";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { ImportForm } from "@/components/crm/settings-admin";
import { ExportMenu } from "@/components/crm/export-menu";
import { CopyField, MetadataExplorer, type EntitySummary } from "@/components/crm/settings-cards";

export const dynamic = "force-dynamic";

/** Hub cards. `area` is the settings grant that decides whether the card shows. */
const SECTIONS: { href: string; key: string; icon: string; area: string }[] = [
  { href: "/settings/profile", key: "profile", icon: "user", area: "settings.profile" },
  { href: "/settings/security", key: "security", icon: "lock", area: "settings.security" },
  { href: "/settings/notifications", key: "notifications", icon: "bell", area: "settings.notifications" },
  { href: "/settings/appearance", key: "appearance", icon: "settings", area: "settings.appearance" },
  { href: "/settings/roles", key: "roles", icon: "shield", area: "settings.roles" },
  { href: "/settings/users", key: "users", icon: "users", area: "settings.users" },
  { href: "/settings/mobile", key: "mobile", icon: "smartphone", area: "settings.mobile" },
];

/** Icon shown for each feature flag. */
const FLAG_ICON: Record<string, string> = {
  metadataGovernance: "shield",
  csvExport: "download",
  globalSearch: "search",
  betaForecast: "trending",
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

function releaseIcon(kind: string): string {
  const k = kind.toLowerCase();
  if (k.includes("publish")) return "send";
  if (k.includes("rollback")) return "recurring";
  if (k.includes("approve")) return "shield";
  if (k.includes("metadata") || k.includes("schema")) return "database";
  return "activity";
}
function releaseTone(kind: string): "success" | "warning" | "info" {
  const k = kind.toLowerCase();
  if (k.includes("publish") || k.includes("approve")) return "success";
  if (k.includes("rollback") || k.includes("reject")) return "warning";
  return "info";
}
const TONE_DOT: Record<string, string> = {
  success: "text-success",
  warning: "text-warning",
  info: "text-primary",
};

export default async function SettingsPage() {
  const ctx = await getServerContext();
  const t = await getT();
  const locale = await getLocale();
  // Every card below is gated on its own settings grant, so a position sees the
  // sections it was given and nothing else.
  const access = settingsAccess(ctx);
  const sections = SECTIONS.filter((s) => access.can(s.area, "read"));
  const canWorkspace = access.can("settings.workspace", "read");
  const canFlags = access.can("settings.featureFlags", "read");
  // The data model is infrastructure, not tenant configuration — administrators
  // only, and the area is kept out of the permission matrix entirely.
  const isAdmin = ctx.roles.includes("admin");
  const canMetadata = isAdmin;
  const canImport = access.can("settings.import", "read");
  const canExport = access.can("settings.export", "read");
  const canReleases = access.can("settings.releases", "read");
  const entities = metadata.listEntities();
  // Importable / exportable = every non-system (non-line-item) entity, derived live
  // from the published model — so the list can never go stale or miss an entity.
  // Labels are localized to the active language.
  const importable = entities
    .filter((e) => !e.system)
    .map((e) => ({ name: e.name, label: entityLabel(e, locale, { plural: true }) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
  const releases = canReleases ? await serverApi.releases().catch(() => []) : [];
  // The Account card shows the company this user belongs to (set when the user
  // was created); it falls back to the tenant id when none is assigned yet.
  const me = await serverApi.me();
  const companyName = me.companyId
    ? await serverApi
        .get("company", me.companyId)
        .then((c) => String(c.name ?? ""))
        .catch(() => "")
    : "";

  const entitySummaries: EntitySummary[] = entities.map((e) => ({
    name: e.name,
    pluralLabel: e.pluralLabel,
    group: e.group,
    icon: e.icon,
    fieldCount: e.fields.length,
    system: Boolean(e.system),
  }));

  const flags = Object.keys(FEATURE_FLAGS) as FeatureFlag[];
  const flagOn = (f: FeatureFlag) => ctx.featureFlags[f] ?? FEATURE_FLAGS[f];
  const enabledCount = flags.filter(flagOn).length;
  const flagText = (f: string, suffix: "" | ".desc") => {
    const key = `settings.flag.${f}${suffix}`;
    const v = t(key);
    return v === key ? (suffix ? "" : f) : v;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{t("settings.title")}</h1>
        <p className="text-xs text-muted">{t("settings.subtitle")}</p>
      </div>

      {/* Settings sections */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group glass glass-sheen flex items-center gap-3 rounded-2xl px-4 py-3.5 shadow-[var(--shadow-glass)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-primary-foreground">
              <Icon name={s.icon} className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t(`settings.sec.${s.key}.title`)}</span>
              <span className="block truncate text-xs text-muted">{t(`settings.sec.${s.key}.desc`)}</span>
            </span>
            <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-muted-2 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      {(canWorkspace || canFlags) && (
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Account */}
        {canWorkspace && (
        <Card>
          <CardHeader
            title={t("settings.account")}
            action={
              access.can("settings.profile", "read") ? (
                <Link href="/settings/profile" className="text-xs font-medium text-primary hover:underline">
                  {t("settings.manageProfile")} →
                </Link>
              ) : undefined
            }
          />
          <CardBody className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-hover text-base font-semibold text-primary-foreground">
                {initials(ctx.displayName)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{ctx.displayName}</p>
                <p className="truncate text-xs text-muted">{ctx.email}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ctx.roles.map((r) => (
                    <Badge key={r} tone="info">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-0.5 border-t border-border pt-2">
              <CopyField label={t("settings.tenant")} value={companyName || ctx.tenantId} mono={!companyName} />
              <CopyField label={t("settings.org")} value={ctx.orgId} mono />
              <CopyField label={t("settings.userId")} value={ctx.userId} mono />
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-xs text-muted">{t("settings.locale")}</span>
                <span className="text-sm uppercase">{ctx.locale}</span>
              </div>
            </div>
          </CardBody>
        </Card>
        )}

        {/* Feature flags */}
        {canFlags && (
        <Card>
          <CardHeader
            title={t("settings.featureFlags")}
            action={
              <Badge tone="info">{t("settings.flagsEnabled", { on: String(enabledCount), total: String(flags.length) })}</Badge>
            }
          />
          <CardBody className="space-y-1">
            {flags.map((flag) => {
              const on = flagOn(flag);
              return (
                <div key={flag} className="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2/50">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      on ? "bg-primary/10 text-primary" : "bg-surface-2 text-muted-2",
                    )}
                  >
                    <Icon name={FLAG_ICON[flag] ?? "settings"} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{flagText(flag, "")}</p>
                    <p className="text-xs text-muted">{flagText(flag, ".desc")}</p>
                  </div>
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                      on ? "bg-success/10 text-success" : "bg-surface-2 text-muted-2",
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-success" : "bg-muted-2")} />
                    {on ? t("settings.on") : t("settings.off")}
                  </span>
                </div>
              );
            })}
          </CardBody>
        </Card>
        )}
      </div>
      )}

      {/* Metadata explorer */}
      {canMetadata && (
        <MetadataExplorer
          version={metadata.version}
          entities={entitySummaries}
          canPublish={isAdmin}
        />
      )}

      {/* Import / Export */}
      {(canImport || canExport) && (
      <Card>
        <CardHeader title={t("settings.importExport")} />
        <CardBody className="space-y-5">
          {canImport && (
          <section>
            <div className="mb-2 flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-muted">
                <Icon name="upload" className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">{t("settings.importTitle")}</p>
                <p className="text-xs text-muted">{t("settings.importDesc")}</p>
              </div>
            </div>
            <ImportForm entities={importable} disabled={!access.can("settings.import", "execute")} />
          </section>
          )}

          {canExport && (
          <section className={canImport ? "border-t border-border pt-4" : undefined}>
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-muted">
                <Icon name="download" className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">{t("settings.exportTitle")}</p>
                <p className="text-xs text-muted">{t("settings.exportDesc")}</p>
              </div>
            </div>
            {access.can("settings.export", "execute") ? (
              <div className="flex flex-wrap gap-2">
                {importable.map((e, i) => (
                  <span key={e.name} className="animate-fade" style={{ animationDelay: `${Math.min(i * 25, 300)}ms` }}>
                    <ExportMenu entity={e.name} label={e.label} />
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-2">{t("settings.readOnly")}</p>
            )}
          </section>
          )}
        </CardBody>
      </Card>
      )}

      {/* Release / audit trail */}
      {canReleases && (
      <Card>
        <CardHeader
          title={t("settings.releaseTrail")}
          action={releases.length > 0 ? <Badge tone="neutral">{String(releases.length)}</Badge> : undefined}
        />
        <CardBody>
          {releases.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-muted-2">
                <Icon name="shield" className="h-5 w-5" />
              </span>
              <p className="text-sm text-muted">{t("settings.noReleases")}</p>
            </div>
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-6">
              {releases.map((r) => {
                const tone = releaseTone(r.kind);
                return (
                  <li key={r.id} className="relative">
                    <span className="absolute -left-[1.95rem] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-surface ring-1 ring-border">
                      <Icon name={releaseIcon(r.kind)} className={cn("h-3 w-3", TONE_DOT[tone])} />
                    </span>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Badge tone={tone}>{r.kind}</Badge>
                        {r.note && <span className="text-sm">{r.note}</span>}
                      </span>
                      <span className="shrink-0 text-xs text-muted-2">{new Date(r.at).toLocaleString()}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{r.actor}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </CardBody>
      </Card>
      )}

      {sections.length === 0 && !canWorkspace && !canFlags && !canMetadata && !canImport && !canExport && !canReleases && (
        <Card>
          <CardBody>
            <EmptyState icon="shield" title={t("settings.denied.title")} description={t("settings.denied.none")} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
