import { getServerContext } from "@/lib/http/server-context";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/messages";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AutomationConsole } from "@/components/crm/automation/console";

export const dynamic = "force-dynamic";

export default async function AutomationPage() {
  const ctx = await getServerContext();
  const isAdmin = ctx.roles.includes("admin");

  if (!isAdmin) {
    const locale = await getLocale();
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">{t(locale, "auto.title")}</h1>
        <Card>
          <EmptyState icon="shield" title={t(locale, "auto.adminOnly")} description={t(locale, "auto.adminOnlyDesc")} />
        </Card>
      </div>
    );
  }

  return <AutomationConsole />;
}
