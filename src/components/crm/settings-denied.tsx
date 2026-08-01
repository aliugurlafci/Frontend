import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/messages";

/**
 * 403 for a Settings section the signed-in position isn't granted.
 *
 * The screen gate (AppShell) only knows whether /settings may be opened at all;
 * each section additionally checks its own `settings.<area>` grant and renders
 * this instead of its content when the grant is missing.
 */
export async function SettingsDenied({ area }: { area: string }) {
  const locale = await getLocale();
  const key = `perm.area.${area}`;
  const label = t(locale, key);
  return (
    <Card>
      <CardBody>
        <EmptyState
          icon="shield"
          title={t(locale, "settings.denied.title")}
          description={t(locale, "settings.denied.desc", { area: label === key ? area : label })}
        />
      </CardBody>
    </Card>
  );
}
