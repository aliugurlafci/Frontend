"use client";

/**
 * Client-side locale + translation hook. Bespoke client screens read the locale
 * from the `aula_locale` cookie (same source the server uses) and translate via
 * the shared message catalog. SSR/first render uses DEFAULT_LOCALE so hydration
 * matches; the real cookie value is applied right after mount.
 */
import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { t as translate } from "./messages";

function readCookieLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  for (const part of document.cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === LOCALE_COOKIE) {
      const value = decodeURIComponent(v.join("="));
      if (isLocale(value)) return value;
    }
  }
  return DEFAULT_LOCALE;
}

export function useLocale(): Locale {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  useEffect(() => {
    setLocale(readCookieLocale());
  }, []);
  return locale;
}

/** Returns a `t(key, vars?)` translator bound to the current locale. */
export function useT(): (key: string, vars?: Record<string, string>) => string {
  const locale = useLocale();
  return (key, vars) => translate(locale, key, vars);
}
