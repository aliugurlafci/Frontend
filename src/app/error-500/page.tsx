"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { AuthLayout, AUTH_BUTTON } from "@/components/ui/auth-layout";

export default function Error500Page() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <AuthLayout center>
      <p className="text-gradient text-7xl font-black tracking-tight">500</p>
      <h1 className="mt-3 text-2xl font-bold">{t("auth.error500.title")}</h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted">{t("auth.error500.desc")}</p>

      <button type="button" onClick={() => router.push("/")} className={`${AUTH_BUTTON} mt-7 w-auto px-6`}>
        {t("auth.backHome")}
      </button>
    </AuthLayout>
  );
}
