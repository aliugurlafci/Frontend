/** Phase 10 — metadata-driven value formatting (shared by table + detail). */
import type { FieldDef, FieldValue } from "@/lib/metadata/types";
import type { Tone } from "@/components/ui/badge";
import { type Locale } from "@/lib/i18n/config";
import { enumLabel } from "@/lib/i18n/labels";
import { t } from "@/lib/i18n/messages";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** Format a value for display; `locale` localizes enums + booleans (default EN). */
export function formatValue(field: FieldDef, value: FieldValue, locale: Locale = "en"): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (field.type) {
    case "currency":
      return typeof value === "number" ? currency.format(value) : String(value);
    case "percent":
      return typeof value === "number" ? `${value}%` : String(value);
    case "boolean":
      return value ? t(locale, "common.yes") : t(locale, "common.no");
    case "date":
    case "datetime":
      return typeof value === "string" ? new Date(value).toLocaleDateString() : String(value);
    case "enum":
      return enumLabel(field, value as string, locale);
    default:
      return String(value);
  }
}

export function enumTone(field: FieldDef, value: FieldValue): Tone {
  return (field.options?.find((o) => o.value === value)?.tone as Tone) ?? "neutral";
}
