import Link from "next/link";
import { serverApi } from "@/lib/http/server-api";
import { getT } from "@/lib/i18n/server";
import { NotificationsForm } from "@/components/crm/settings-notifications-form";
import { MailSyncForm } from "@/components/crm/settings-mailsync-form";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const me = await serverApi.me();
  const t = await getT();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t("settings.notifications.title")}</h1>
          <p className="text-xs text-muted">{t("settings.notifications.subtitle")}</p>
        </div>
        <Link href="/settings" className="text-xs font-medium text-primary hover:underline">
          {t("settings.allSettings")}
        </Link>
      </div>
      <MailSyncForm />
      <NotificationsForm initial={me.notificationPrefs} />
    </div>
  );
}
