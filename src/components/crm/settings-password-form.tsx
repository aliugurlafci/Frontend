"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function PasswordForm() {
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!current || !next) {
      toast.error(t("settings.password.errFill"));
      return;
    }
    if (next.length < 6) {
      toast.error(t("settings.password.errLen"));
      return;
    }
    if (next !== confirm) {
      toast.error(t("settings.password.errMatch"));
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/auth/password", { method: "PATCH", body: { currentPassword: current, newPassword: next } });
      toast.success(t("settings.password.updated"));
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : t("settings.password.updateFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title={t("settings.password.title")} />
      <CardBody className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="current">{t("settings.password.current")}</Label>
            <Input id="current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <Label htmlFor="new">{t("settings.password.new")}</Label>
            <Input id="new" type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <Label htmlFor="confirm">{t("settings.password.confirm")}</Label>
            <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="primary" loading={busy} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
