import Link from "next/link";
import { serverApi } from "@/lib/http/server-api";
import { getT } from "@/lib/i18n/server";
import { ProfileForm } from "@/components/crm/settings-profile-form";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
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
        initial={{
          displayName: me.displayName,
          email: me.email,
          phone: me.phone ?? "",
          timezone: me.timezone ?? "UTC",
        }}
      />
    </div>
  );
}
