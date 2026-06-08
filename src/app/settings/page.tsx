import Link from "next/link";
import { getServerContext } from "@/lib/http/server-context";
import { metadata } from "@/lib/metadata";
import { FEATURE_FLAGS } from "@/lib/config/feature-flags";
import { serverApi } from "@/lib/http/server-api";
import { getT } from "@/lib/i18n/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImportForm, RepublishButton } from "@/components/crm/settings-admin";
import { ExportMenu } from "@/components/crm/export-menu";

export const dynamic = "force-dynamic";

const SECTIONS: { href: string; key: string }[] = [
  { href: "/settings/profile", key: "profile" },
  { href: "/settings/security", key: "security" },
  { href: "/settings/notifications", key: "notifications" },
  { href: "/settings/appearance", key: "appearance" },
  { href: "/settings/roles", key: "roles" },
  { href: "/settings/users", key: "users" },
];

export default async function SettingsPage() {
  const ctx = await getServerContext();
  const t = await getT();
  const isAdmin = ctx.roles.includes("admin");
  const entities = metadata.listEntities();
  const importable = entities.filter((e) => !e.system).map((e) => ({ name: e.name, label: e.label }));
  const releases = isAdmin ? await serverApi.releases().catch(() => []) : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{t("settings.title")}</h1>
        <p className="text-xs text-muted">{t("settings.subtitle")}</p>
      </div>

      {/* Settings sections */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Card key={s.href}>
            <CardHeader title={t(`settings.sec.${s.key}.title`)} />
            <CardBody className="space-y-3 text-sm">
              <p className="text-muted">{t(`settings.sec.${s.key}.desc`)}</p>
              <Link href={s.href} className="inline-flex text-xs font-medium text-primary hover:underline">
                {t("settings.open")} →
              </Link>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Account summary */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("settings.account")} />
          <CardBody className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">{t("settings.name")}</span>
              <span>{ctx.displayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{t("settings.email")}</span>
              <span>{ctx.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{t("settings.roles")}</span>
              <span className="flex gap-1">
                {ctx.roles.map((r) => (
                  <Badge key={r} tone="info">
                    {r}
                  </Badge>
                ))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{t("settings.tenant")}</span>
              <span>{ctx.tenantId}</span>
            </div>
            <p className="pt-2 text-xs text-muted">{t("settings.themeHint")}</p>
          </CardBody>
        </Card>

        {/* Feature flags */}
        <Card>
          <CardHeader title={t("settings.featureFlags")} />
          <CardBody className="space-y-1.5 text-sm">
            {Object.entries(FEATURE_FLAGS).map(([flag, on]) => (
              <div key={flag} className="flex items-center justify-between">
                <span>{flag}</span>
                <Badge tone={on ? "success" : "neutral"}>{on ? t("settings.on") : t("settings.off")}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader title={t("settings.metadata")} action={isAdmin ? <RepublishButton /> : undefined} />
        <CardBody className="text-sm">
          <p className="mb-2 text-xs text-muted">
            {t("settings.publishedVersion")} <strong>v{metadata.version}</strong> ·{" "}
            {t("settings.entitiesCount", { count: String(entities.length) })}
          </p>
          <ul className="grid grid-cols-2 gap-1">
            {entities.map((e) => (
              <li key={e.name} className="flex justify-between rounded bg-surface-2 px-2 py-1">
                <span>{e.pluralLabel}</span>
                <span className="text-muted">{t("settings.fieldsCount", { count: String(e.fields.length) })}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {/* Import / Export */}
      <Card>
        <CardHeader title={t("settings.importExport")} />
        <CardBody className="space-y-4">
          <ImportForm entities={importable} />
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-muted">{t("settings.exportLabel")}</div>
            <div className="flex flex-wrap gap-2">
              {importable.map((e) => (
                <ExportMenu key={e.name} entity={e.name} label={e.label} />
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Release / audit trail */}
      <Card>
        <CardHeader title={t("settings.releaseTrail")} />
        <CardBody>
          {releases.length === 0 ? (
            <p className="text-sm text-muted">{t("settings.noReleases")}</p>
          ) : (
            <ol className="space-y-1.5 text-xs">
              {releases.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <span>
                    <Badge tone="info">{r.kind}</Badge> {r.note ?? ""}
                  </span>
                  <span className="text-muted">
                    {r.actor} · {new Date(r.at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
