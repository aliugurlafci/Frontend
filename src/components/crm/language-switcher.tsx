"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { LOCALES, LOCALE_LABELS, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { Icon } from "@/components/ui/icon";

/** Language switcher — persists the choice in the `aula_locale` cookie. */
export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const router = useRouter();

  function change(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <label className="flex items-center gap-1 text-xs text-muted" title={t("lang.label")}>
      <Icon name="globe" className="h-3.5 w-3.5" />
      <select
        aria-label={t("lang.label")}
        value={locale}
        onChange={(e) => change(e.target.value as Locale)}
        className="h-8 rounded-lg border border-border-strong bg-surface/50 px-1.5 text-xs text-foreground backdrop-blur-sm transition-colors hover:bg-surface focus:outline-none"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
