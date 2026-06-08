"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { AuthLayout, AUTH_FIELD, AUTH_BUTTON } from "@/components/ui/auth-layout";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <AuthLayout title={t("auth.register.title")} subtitle={t("auth.register.subtitle")}>
      <form
        className="mt-7 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/login");
        }}
      >
        {/* Name */}
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-semibold">
            {t("auth.register.name")}
          </label>
          <input id="name" type="text" placeholder="Avery Admin" className={AUTH_FIELD} />
        </div>

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

        {/* Password */}
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
            {t("auth.password")}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className={`${AUTH_FIELD} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-2 hover:text-foreground"
            >
              {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-sm font-semibold">
            {t("auth.register.confirm")}
          </label>
          <div className="relative">
            <input
              id="confirm"
              type={showConfirm ? "text" : "password"}
              placeholder="••••••••"
              className={`${AUTH_FIELD} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              aria-label={showConfirm ? t("auth.hidePassword") : t("auth.showPassword")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-2 hover:text-foreground"
            >
              {showConfirm ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Terms */}
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-border accent-primary" />
          {t("auth.register.terms")}
        </label>

        <button type="submit" className={AUTH_BUTTON}>
          {t("auth.register.signUp")}
        </button>
      </form>

      <p className="mt-5 text-sm text-muted">
        {t("auth.register.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-secondary hover:underline">
          {t("login.signIn")}
        </Link>
      </p>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3 text-xs font-medium text-muted-2">
        <span className="h-px flex-1 bg-border" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Social buttons */}
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          className="flex h-11 items-center justify-center rounded-xl bg-[#1877f2] text-white shadow-sm transition-all hover:brightness-110"
          aria-label={t("auth.continueFacebook")}
        >
          <span className="text-lg font-bold">f</span>
        </button>
        <button
          type="button"
          className="flex h-11 items-center justify-center rounded-xl border border-border-strong bg-surface/60 backdrop-blur-sm transition-colors hover:bg-surface-2"
          aria-label={t("auth.continueGoogle")}
        >
          <span className="text-lg font-bold text-[#ea4335]">G</span>
        </button>
        <button
          type="button"
          className="flex h-11 items-center justify-center rounded-xl bg-black text-white shadow-sm transition-all hover:brightness-125"
          aria-label={t("auth.continueApple")}
        >
          <span className="text-lg"></span>
        </button>
      </div>
    </AuthLayout>
  );
}
