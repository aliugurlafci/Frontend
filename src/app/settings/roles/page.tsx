import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { getLocale } from "@/lib/i18n/server";
import { entityLabel } from "@/lib/i18n/labels";
import { t } from "@/lib/i18n/messages";
import { PositionsAdmin, type PositionRecord, type PermCatalog } from "@/components/crm/positions-admin";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

function parseJsonArray(v: unknown): string[] {
  try {
    const p = JSON.parse(String(v ?? "[]"));
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

export default async function PositionsPage() {
  try {
    const locale = await getLocale();
    const [page, screens, catalog] = await Promise.all([
      serverApi.list("position", { pageSize: 100 }),
      serverApi.screens(),
      serverApi.permissionsCatalog(),
    ]);

    // Localize each screen's label (entity screens → entity plural label; extra
    // screens → nav.* key) and build a localized group-header map, so a Turkish
    // admin sees meaningful names when granting access.
    const entityByName = new Map(metadata.listEntities().map((e) => [e.name, e]));
    const localizedScreens = screens.map((s) => {
      const entity = entityByName.get(s.key);
      if (entity) return { ...s, label: entityLabel(entity, locale, { plural: true }) };
      const navKey = `nav.${s.key}`;
      const navLabel = t(locale, navKey);
      return { ...s, label: navLabel === navKey ? s.label : navLabel };
    });
    const groupLabels: Record<string, string> = {};
    for (const s of localizedScreens) groupLabels[s.group] ??= t(locale, `group.${s.group}`);

    // Localize the permission catalog's entity labels + group headers.
    const permCatalog: PermCatalog = {
      entities: catalog.entities.map((e) => {
        const entity = entityByName.get(e.name);
        return { name: e.name, group: e.group, actions: e.actions, label: entity ? entityLabel(entity, locale, { plural: true }) : e.name };
      }),
      special: catalog.special,
      rolePresets: Object.fromEntries(catalog.roles.map((r) => [r.value, r.grants])),
    };
    for (const e of permCatalog.entities) groupLabels[e.group] ??= t(locale, `group.${e.group}`);

    const positions: PositionRecord[] = page.items.map((p) => ({
      id: p.id,
      name: String(p.name ?? ""),
      role: String(p.role ?? "sales_rep"),
      description: (p.description as string | null) ?? null,
      screens: parseJsonArray(p.screens),
      permissions: parseJsonArray(p.permissions),
      version: p.version,
    }));
    return <PositionsAdmin initial={positions} screens={localizedScreens} groupLabels={groupLabels} catalog={permCatalog} />;
  } catch {
    const locale = await getLocale();
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon="shield"
            title={t(locale, "settings.users.adminsOnly")}
            description={t(locale, "settings.roles.adminsOnlyDesc")}
          />
        </CardBody>
      </Card>
    );
  }
}
