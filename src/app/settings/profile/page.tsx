import Link from "next/link";
import { serverApi } from "@/lib/http/server-api";
import { getServerContext } from "@/lib/http/server-context";
import { settingsAccess } from "@/lib/permissions/settings-access";
import { getT } from "@/lib/i18n/server";
import { ProfileForm } from "@/components/crm/settings-profile-form";
import { SettingsDenied } from "@/components/crm/settings-denied";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const ctx = await getServerContext();
  const access = settingsAccess(ctx);
  if (!access.can("settings.profile", "read")) return <SettingsDenied area="settings.profile" />;

  const me = await serverApi.me();
  const t = await getT();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t("settings.profile.title")}</h1>
          <p className="text-xs text-muted">{t("settings.profile.subtitle")}</p>
        </div>
        <Link href="/settings" className="text-xs font-medium text-primary hover:underline">
          {t("settings.allSettings")}
        </Link>
      </div>
      <ProfileForm
        canUpdate={access.can("settings.profile", "update")}
        canChangeAvatar={access.can("settings.profile", "avatar")}
        initial={{
          displayName: me.displayName,
          email: me.email,
          phone: me.phone ?? "",
          timezone: me.timezone ?? "UTC",
          avatarId: me.avatarId ?? "",
          jobTitle: me.jobTitle ?? "",
          location: me.location ?? "",
          bio: me.bio ?? "",
        }}
      />
    </div>
  );
}
