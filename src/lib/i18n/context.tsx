"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { EntityDef, FieldDef } from "@/lib/metadata/types";
import type { Locale } from "./config";
import { t as translate } from "./messages";
import { entityLabel, entityLabelByName, fieldLabel, enumLabel } from "./labels";

interface I18nContextValue {
  locale: Locale;
  /** Translate a UI string key, with optional {var} interpolation. */
  t: (key: string, vars?: Record<string, string>) => string;
  /** Localized entity label (singular by default, plural via opts). */
  entityLabel: (def: EntityDef, opts?: { plural?: boolean }) => string;
  /** Localized entity label from just the entity name + an English fallback. */
  entityLabelByName: (name: string, fallback: string, opts?: { plural?: boolean }) => string;
  /** Localized field label (pass entityName for entity-specific overrides). */
  fieldLabel: (field: FieldDef, entityName?: string) => string;
  /** Localized enum option label for a value. */
  enumLabel: (field: FieldDef, value: string | null | undefined) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value: I18nContextValue = {
    locale,
    t: (key, vars) => translate(locale, key, vars),
    entityLabel: (def, opts) => entityLabel(def, locale, opts),
    entityLabelByName: (name, fallback, opts) => entityLabelByName(name, fallback, locale, opts),
    fieldLabel: (field, entityName) => fieldLabel(field, locale, entityName),
    enumLabel: (field, val) => enumLabel(field, val, locale),
  };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}
