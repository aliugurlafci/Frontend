import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/messages";

/** 403 shown when a signed-in user opens a screen their position can't access. */
export async function AccessDenied({ screen }: { screen: string }) {
  const locale = await getLocale();
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">{t(locale, "access.title")}</h1>
      <Card>
        <CardBody>
          <EmptyState icon="settings" title={t(locale, "access.heading")} description={t(locale, "access.desc", { screen })} />
        </CardBody>
      </Card>
    </div>
  );
}
