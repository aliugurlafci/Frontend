import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { PasswordForm } from "@/components/crm/settings-password-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const t = await getT();
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

      <Card>
        <CardHeader title={t("settings.security.twoFactor")} action={<Badge tone="warning">{t("settings.off")}</Badge>} />
        <CardBody className="flex items-center justify-between gap-3 text-sm">
          <p className="text-muted">{t("settings.security.twoFactorDesc")}</p>
          <Button variant="outline" size="sm" type="button" disabled title={t("settings.security.notAvailable")}>
            {t("settings.security.enable2fa")}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("settings.security.sessions")} />
        <CardBody className="text-sm text-muted">{t("settings.security.sessionsDesc")}</CardBody>
      </Card>
    </div>
  );
}
