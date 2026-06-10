"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { LOCALES, LOCALE_LABELS, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { Icon } from "@/components/ui/icon";
import { DropdownMenu, MenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";

/** Language switcher — an icon-button dropdown; persists to the `aula_locale` cookie. */
export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const router = useRouter();

  function change(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <DropdownMenu
      align="end"
      panelClassName="w-40"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={t("lang.label")}
          title={t("lang.label")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-all hover:bg-surface-2 hover:text-foreground active:scale-95"
        >
          <Icon name="globe" className="h-4 w-4" />
        </button>
      )}
    >
      {({ close }) => (
        <>
          {LOCALES.map((l) => (
            <MenuItem
              key={l}
              onClick={() => {
                change(l);
                close();
              }}
            >
              <span className={cn("flex-1", l === locale && "font-semibold text-primary")}>{LOCALE_LABELS[l]}</span>
              {l === locale && <Icon name="check" className="h-3.5 w-3.5 text-primary" />}
            </MenuItem>
          ))}
        </>
      )}
    </DropdownMenu>
  );
}
