/**
 * Locale-aware value formatting for reports & dashboards.
 *
 * Pure helpers usable from both server and client components. They map the app
 * locale (tr/en/de) to a BCP-47 tag so `Intl` renders the right thousands /
 * decimal separators, currency placement and date style.
 */
import type { Locale } from "./config";

const TAG: Record<Locale, string> = { tr: "tr-TR", en: "en-US", de: "de-DE" };

export function localeTag(locale: Locale): string {
  return TAG[locale] ?? "en-US";
}

export function fmtMoney(locale: Locale, amount: number, code = "USD"): string {
  try {
    return new Intl.NumberFormat(localeTag(locale), { style: "currency", currency: code, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

/** Compact money (e.g. $1.2M) for chart axes/centres. */
export function fmtMoneyCompact(locale: Locale, amount: number, code = "USD"): string {
  try {
    return new Intl.NumberFormat(localeTag(locale), { style: "currency", currency: code, notation: "compact", maximumFractionDigits: 1 }).format(amount);
  } catch {
    return `${amount} ${code}`;
  }
}

export function fmtNumber(locale: Locale, n: number): string {
  return new Intl.NumberFormat(localeTag(locale)).format(n);
}

export function fmtNumberCompact(locale: Locale, n: number): string {
  return new Intl.NumberFormat(localeTag(locale), { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** `n` is a whole-number percentage (e.g. 42 → "42%"). */
export function fmtPercent(locale: Locale, n: number): string {
  return new Intl.NumberFormat(localeTag(locale), { style: "percent", maximumFractionDigits: 0 }).format(n / 100);
}

export function fmtDate(locale: Locale, iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "medium" }).format(d);
}

export function fmtDateTime(locale: Locale, iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function fmtTime(locale: Locale, iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(localeTag(locale), { timeStyle: "short" }).format(d);
}
