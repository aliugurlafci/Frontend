"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";

interface SetupData {
  secret: string;
  otpauth: string;
}

/** Two-factor (TOTP) enrollment + disable. Secret is generated + stored server-side. */
export function TwoFactorForm({ initialEnabled }: { initialEnabled: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [disarming, setDisarming] = useState(false);
  const [busy, setBusy] = useState(false);

  function fail(e: unknown) {
    toast.error(e instanceof ApiRequestError ? e.message : t("common.error"));
  }

  async function beginSetup() {
    setBusy(true);
    try {
      const res = await apiFetch<SetupData>("/auth/2fa/setup", { method: "POST" });
      setSetup(res);
      setCode("");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    if (!/^\d{6}$/.test(code.trim())) {
      toast.error(t("twofa.codeInvalid"));
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/auth/2fa/enable", { method: "POST", body: { code: code.trim() } });
      setEnabled(true);
      setSetup(null);
      setCode("");
      toast.success(t("twofa.enabled"));
      router.refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!password) {
      toast.error(t("twofa.passwordRequired"));
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/auth/2fa/disable", { method: "POST", body: { password } });
      setEnabled(false);
      setDisarming(false);
      setPassword("");
      toast.success(t("twofa.disabled"));
      router.refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={t("settings.security.twoFactor")}
        action={<Badge tone={enabled ? "success" : "warning"}>{enabled ? t("settings.on") : t("settings.off")}</Badge>}
      />
      <CardBody className="space-y-4 text-sm">
        <p className="text-muted">{t("settings.security.twoFactorDesc")}</p>

        {/* Enabled → offer disable */}
        {enabled ? (
          !disarming ? (
            <div>
              <Button variant="outline" size="sm" onClick={() => setDisarming(true)}>
                {t("twofa.disable")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface px-3 py-2">
              <div className="flex-1">
                <Label htmlFor="twofa-pw">{t("twofa.confirmPassword")}</Label>
                <Input id="twofa-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <Button variant="danger" size="sm" loading={busy} onClick={disable}>
                {t("twofa.disable")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setDisarming(false); setPassword(""); }}>
                {t("twofa.cancel")}
              </Button>
            </div>
          )
        ) : setup ? (
          /* Mid-enrollment → show QR + key + code */
          <div className="space-y-3">
            <p className="text-xs text-muted">{t("twofa.scanHint")}</p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-lg border border-border bg-white p-2">
                <QRCodeSVG value={setup.otpauth} size={148} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted">{t("twofa.manualKey")}</p>
                <code className="block break-all rounded bg-surface-2 px-2 py-1 text-xs font-mono">{setup.secret}</code>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="twofa-code">{t("twofa.enterCode")}</Label>
                <Input
                  id="twofa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-32 tracking-widest"
                />
              </div>
              <Button variant="primary" size="sm" loading={busy} onClick={confirmEnable}>
                {t("twofa.verifyEnable")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSetup(null)}>
                {t("twofa.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          /* Disabled → offer enable */
          <div>
            <Button variant="outline" size="sm" loading={busy} onClick={beginSetup}>
              {t("settings.security.enable2fa")}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
