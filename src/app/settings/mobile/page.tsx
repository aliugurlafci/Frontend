import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { getLocale } from "@/lib/i18n/server";
import { entityLabel } from "@/lib/i18n/labels";
import { t } from "@/lib/i18n/messages";
import { MobileScreensAdmin, type MobileScreen, type NamedRef } from "@/components/crm/mobile-screens-admin";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function MobileSettingsPage() {
  try {
    const locale = await getLocale();
    const [catalog, configs, positionsPage, users] = await Promise.all([
      serverApi.mobileScreens(),
      serverApi.mobileConfigs(),
      serverApi.list("position", { pageSize: 100 }),
      serverApi.adminUsers(),
    ]);

    // Localize each screen label (entity screens → plural entity label; extra
    // screens → nav.* key) + group headers, mirroring the roles editor.
    const entityByName = new Map(metadata.listEntities().map((e) => [e.name, e]));
    const screens: MobileScreen[] = catalog.map((s) => {
      const entity = entityByName.get(s.key);
      if (entity) return { ...s, label: entityLabel(entity, locale, { plural: true }) };
      const navKey = `nav.${s.key}`;
      const navLabel = t(locale, navKey);
      return { ...s, label: navLabel === navKey ? s.label : navLabel };
    });
    const groupLabels: Record<string, string> = {};
    for (const s of screens) groupLabels[s.group] ??= t(locale, `group.${s.group}`);

    const positions: NamedRef[] = positionsPage.items.map((p) => ({ id: String(p.id), name: String(p.name ?? p.id) }));
    const userRefs: NamedRef[] = users.map((u) => ({
      id: String(u.id),
      name: String(u.displayName ?? u.email ?? u.id),
    }));

    return <MobileScreensAdmin initial={configs} screens={screens} groupLabels={groupLabels} positions={positions} users={userRefs} />;
  } catch {
    const locale = await getLocale();
    return (
      <Card>
        <CardBody>
          <EmptyState icon="smartphone" title={t(locale, "settings.sec.mobile.title")} description={t(locale, "mobile.adminsOnly")} />
        </CardBody>
      </Card>
    );
  }
}
