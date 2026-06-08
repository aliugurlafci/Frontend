import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { AppearanceForm } from "@/components/crm/settings-appearance-form";

export const dynamic = "force-dynamic";

export default async function AppearanceSettingsPage() {
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
      <AppearanceForm />
    </div>
  );
}
