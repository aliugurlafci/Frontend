import Link from "next/link";
import { serverApi } from "@/lib/http/server-api";
import { getT } from "@/lib/i18n/server";
import { PasswordForm } from "@/components/crm/settings-password-form";
import { TwoFactorForm } from "@/components/crm/settings-twofactor-form";
import { SecurityActivity } from "@/components/crm/settings-security-activity";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const t = await getT();
  const me = await serverApi.me();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t("settings.security.title")}</h1>
          <p className="text-xs text-muted">{t("settings.security.subtitle")}</p>
        </div>
        <Link href="/settings" className="text-xs font-medium text-primary hover:underline">
          {t("settings.allSettings")}
        </Link>
      </div>

      <PasswordForm />
      <TwoFactorForm initialEnabled={me.twoFactorEnabled} />
      <SecurityActivity />
    </div>
  );
}
