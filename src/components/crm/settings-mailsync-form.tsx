"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/context";
import { useSettings } from "@/components/ui/settings-provider";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const MIN_SECONDS = 15;

/** Configures the background mail-sync cadence (per-user, stored in the userSetting table). */
export function MailSyncForm() {
  const { t } = useI18n();
  const { settings, setSetting } = useSettings();
  const [value, setValue] = useState(settings.mailSyncInterval || "60");

  function save() {
    let n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < MIN_SECONDS) n = MIN_SECONDS;
    setValue(String(n));
    setSetting("mailSyncInterval", String(n));
    toast.success(t("settings.mailSync.saved"));
  }

  return (
    <Card>
      <CardHeader title={t("settings.mailSync.title")} />
      <CardBody className="space-y-3">
        <p className="text-xs text-muted">{t("settings.mailSync.desc")}</p>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="mail-sync-interval">{t("settings.mailSync.label")}</Label>
            <Input
              id="mail-sync-interval"
              type="number"
              min={MIN_SECONDS}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-32"
            />
          </div>
          <Button variant="primary" size="sm" onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
