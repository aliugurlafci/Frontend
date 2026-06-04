"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { metadata } from "@/lib/metadata";
import type { EntityDef } from "@/lib/metadata/types";

export interface FieldLookups {
  /** Reference field → selectable options (referenced records). */
  options: Record<string, { value: string; label: string }[]>;
  /** `suggest` string field → distinct values already in use. */
  suggestions: Record<string, string[]>;
}

/**
 * Load form lookups for an entity: options for every `reference` field (the
 * referenced records) and value suggestions for every `suggest` string field
 * (its distinct existing values). Failures (e.g. no read permission) are ignored
 * so the field gracefully falls back to free text.
 */
export function useFieldLookups(entity: EntityDef): FieldLookups {
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
  }, [entity]);

  return lookups;
}
