import Link from "next/link";
import { getServerContext } from "@/lib/http/server-context";
import { settingsAccess } from "@/lib/permissions/settings-access";
import { getT } from "@/lib/i18n/server";
import { AppearanceForm } from "@/components/crm/settings-appearance-form";
import { SettingsDenied } from "@/components/crm/settings-denied";

export const dynamic = "force-dynamic";

export default async function AppearanceSettingsPage() {
  const ctx = await getServerContext();
  const access = settingsAccess(ctx);
  if (!access.can("settings.appearance", "read")) return <SettingsDenied area="settings.appearance" />;

  const t = await getT();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t("settings.appearance.title")}</h1>
          <p className="text-xs text-muted">{t("settings.appearance.subtitle")}</p>
        </div>
        <Link href="/settings" className="text-xs font-medium text-primary hover:underline">
          {t("settings.allSettings")}
        </Link>
      </div>
      <AppearanceForm canUpdate={access.can("settings.appearance", "update")} />
    </div>
  );
}
