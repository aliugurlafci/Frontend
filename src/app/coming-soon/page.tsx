"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { AuthLayout, AUTH_FIELD, AUTH_BUTTON } from "@/components/ui/auth-layout";

export default function ComingSoonPage() {
  const { t } = useI18n();
  const [submitted, setSubmitted] = useState(false);

  return (
    <AuthLayout center title={t("auth.comingSoon.title")} subtitle={t("auth.comingSoon.subtitle")}>
      <form
        className="mt-7 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
        }}
      >
        <div className="relative flex-1">
          <input type="email" placeholder="you@example.com" className={`${AUTH_FIELD} pr-10`} />
          <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
        </div>
        <button type="submit" className={`${AUTH_BUTTON} sm:w-auto sm:px-6`}>
          {t("auth.comingSoon.notify")}
        </button>
      </form>

      {submitted && <p className="mt-4 text-sm text-secondary">{t("auth.comingSoon.thanks")}</p>}
    </AuthLayout>
  );
}
