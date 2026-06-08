/** Server-side locale resolution (from the `aula_locale` cookie). */
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { t as translate } from "./messages";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Server-side translator bound to the request locale (for async server components). */
export async function getT(): Promise<(key: string, vars?: Record<string, string>) => string> {
  const locale = await getLocale();
  return (key, vars) => translate(locale, key, vars);
}
