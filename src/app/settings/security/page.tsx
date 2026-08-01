import Link from "next/link";
import { serverApi } from "@/lib/http/server-api";
import { getServerContext } from "@/lib/http/server-context";
import { settingsAccess } from "@/lib/permissions/settings-access";
import { getT } from "@/lib/i18n/server";
import { PasswordForm } from "@/components/crm/settings-password-form";
import { TwoFactorForm } from "@/components/crm/settings-twofactor-form";
import { SecurityActivity } from "@/components/crm/settings-security-activity";
import { SettingsDenied } from "@/components/crm/settings-denied";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const ctx = await getServerContext();
  const access = settingsAccess(ctx);
  if (!access.can("settings.security", "read")) return <SettingsDenied area="settings.security" />;

  const t = await getT();
  const me = await serverApi.me();
  // Password change, two-factor enrollment and the sign-in history are each
  // separately grantable — a position may see one without the others.
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

      {access.can("settings.security", "password") && <PasswordForm />}
      {access.can("settings.security", "twoFactor") && <TwoFactorForm initialEnabled={me.twoFactorEnabled} />}
      {access.can("settings.security", "activity") && <SecurityActivity />}
    </div>
  );
}
