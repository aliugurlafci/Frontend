import { test } from "node:test";
import assert from "node:assert/strict";
import { MESSAGES } from "@/lib/i18n/messages";

/**
 * Key-parity guard: every locale must define exactly the same keys as the EN
 * base. Without this, a forgotten TR/DE translation silently falls back to
 * English (or the raw key) at runtime instead of failing loudly here.
 */
const en = MESSAGES.en;
const enKeys = new Set(Object.keys(en));

for (const locale of ["tr", "de"] as const) {
  test(`i18n: ${locale} has no missing keys vs en`, () => {
    const dict = MESSAGES[locale];
    const missing = [...enKeys].filter((k) => !(k in dict));
    assert.deepEqual(missing, [], `${locale} is missing ${missing.length} key(s): ${missing.slice(0, 20).join(", ")}`);
  });

  test(`i18n: ${locale} has no extra keys not in en`, () => {
    const extra = Object.keys(MESSAGES[locale]).filter((k) => !enKeys.has(k));
    assert.deepEqual(extra, [], `${locale} has ${extra.length} key(s) absent from en: ${extra.slice(0, 20).join(", ")}`);
  });
}

test("i18n: no empty translations", () => {
  const empties: string[] = [];
  for (const locale of ["en", "tr", "de"] as const) {
    for (const [k, v] of Object.entries(MESSAGES[locale])) {
      if (typeof v !== "string" || v.trim() === "") empties.push(`${locale}:${k}`);
    }
  }
  assert.deepEqual(empties, [], `empty translations: ${empties.slice(0, 20).join(", ")}`);
});
