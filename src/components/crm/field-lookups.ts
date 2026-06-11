"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { metadata } from "@/lib/metadata";
import type { EntityDef } from "@/lib/metadata/types";
import { useI18n } from "@/lib/i18n/context";

export interface FieldLookups {
  /** Reference field → selectable options (referenced records). */
  options: Record<string, { value: string; label: string }[]>;
  /** `suggest` string field → distinct values already in use. */
  suggestions: Record<string, string[]>;
}

/**
 * Fetch every record of an entity, paging past the server's max page size (200)
 * so a people picker can list everyone — bounded by `cap` pages so a very large
 * directory can't load unboundedly into a <select>.
 */
async function fetchAllItems(entity: string, cap = 10): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  for (let page = 1; page <= cap; page++) {
    const r = await apiFetch<{ items: Record<string, unknown>[]; pageCount?: number }>(
      `/entities/${entity}?page=${page}&pageSize=200`,
    );
    all.push(...r.items);
    if (!r.items.length || page >= (r.pageCount ?? 1)) break;
  }
  return all;
}

/**
 * Load form lookups for an entity: options for every `reference` field (the
 * referenced records) and value suggestions for every `suggest` string field
 * (its distinct existing values). Failures (e.g. no read permission) are ignored
 * so the field gracefully falls back to free text.
 */
export function useFieldLookups(entity: EntityDef): FieldLookups {
  const { t } = useI18n();
  const [lookups, setLookups] = useState<FieldLookups>({ options: {}, suggestions: {} });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const options: FieldLookups["options"] = {};
      const suggestions: FieldLookups["suggestions"] = {};

      await Promise.all(
        entity.fields.map(async (f) => {
          try {
            if (f.type === "reference" && f.referenceEntity) {
              const titleField = metadata.findEntity(f.referenceEntity)?.titleField ?? "id";
              const page = await apiFetch<{ items: Record<string, unknown>[] }>(
                `/entities/${f.referenceEntity}?pageSize=500`,
              );
              options[f.name] = page.items.map((r) => ({
                value: String(r.id),
                label: String(r[titleField] ?? r.id),
              }));
            } else if (f.personPicker) {
              // Combined people picker: employees + users, stored as "kind:id".
              // Paged so everyone is listed, not just the first server page.
              const [emps, users] = await Promise.all([
                fetchAllItems("employee").catch(() => []),
                fetchAllItems("user").catch(() => []),
              ]);
              const empOpts = emps.map((e) => ({
                value: `employee:${e.id}`,
                label: `${[e.firstName, e.lastName].filter(Boolean).join(" ") || e.id} · ${t("person.employee")}`,
              }));
              const userOpts = users.map((u) => ({
                value: `user:${u.id}`,
                label: `${u.displayName || u.id} · ${t("person.user")}`,
              }));
              options[f.name] = [...empOpts, ...userOpts];
            } else if (f.suggest) {
              const { rows } = await apiFetch<{ rows: { key: string | null }[] }>(`/aggregate`, {
                method: "POST",
                body: { entity: entity.name, groupBy: f.name, measures: [{ op: "count", as: "c" }] },
              });
              suggestions[f.name] = rows
                .map((r) => r.key)
                .filter((k): k is string => typeof k === "string" && k.length > 0)
                .sort();
            }
          } catch {
            /* ignore — field falls back to a free-text input */
          }
        }),
      );

      if (!cancelled) setLookups({ options, suggestions });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  return lookups;
}
