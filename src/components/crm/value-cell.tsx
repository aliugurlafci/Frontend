import type { FieldDef, FieldValue } from "@/lib/metadata/types";
import type { Locale } from "@/lib/i18n/config";
import { Badge } from "@/components/ui/badge";
import { enumTone, formatValue } from "./field-format";

/** Render a metadata value. `locale` localizes enum/boolean text (default EN). */
export function ValueCell({ field, value, locale = "en" }: { field: FieldDef; value: FieldValue; locale?: Locale }) {
  if (field.type === "enum" && value !== null && value !== "" && value !== undefined) {
    return <Badge tone={enumTone(field, value)}>{formatValue(field, value, locale)}</Badge>;
  }
  return <span>{formatValue(field, value, locale)}</span>;
}
