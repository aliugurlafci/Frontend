"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { AuthLayout, AUTH_FIELD, AUTH_BUTTON } from "@/components/ui/auth-layout";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <AuthLayout title={t("auth.forgot.title")} subtitle={t("auth.forgot.subtitle")}>
      <form
        className="mt-7 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/reset-password");
        }}
      >
        {/* Email */}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
            {t("auth.emailAddress")}
          </label>
          <div className="relative">
            <input id="email" type="email" placeholder="you@example.com" className={`${AUTH_FIELD} pr-10`} />
            <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
          </div>
        </div>

        <button type="submit" className={AUTH_BUTTON}>
          {t("auth.forgot.send")}
        </button>
      </form>

      <p className="mt-5 text-sm text-muted">
        <Link href="/login" className="font-semibold text-secondary hover:underline">
          {t("auth.forgot.back")}
        </Link>
      </p>
    </AuthLayout>
  );
}
