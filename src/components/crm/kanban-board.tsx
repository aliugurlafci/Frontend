"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { EntityDef, EntityRecord } from "@/lib/metadata/types";
import { apiFetch } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { enumTone, formatValue } from "./field-format";

/**
 * Phase F1 — pipeline kanban. Columns come from the board's enum field; dropping
 * a card invokes the matching lifecycle transition (reusing the transitions API),
 * so only legal stage moves are allowed.
 */
export function KanbanBoard({
  entity,
  items,
  onMoved,
  onCardClick,
}: {
  entity: EntityDef;
  items: EntityRecord[];
  onMoved: () => void;
  onCardClick: (id: string) => void;
}) {
  const groupField = entity.board!.groupByField;
  const field = entity.fields.find((f) => f.name === groupField)!;
  const stages = field.options ?? [];
  const amountField = entity.fields.find((f) => f.type === "currency");
  const [dragId, setDragId] = useState<string | null>(null);

  const byStage = new Map<string, EntityRecord[]>();
  for (const s of stages) byStage.set(s.value, []);
  for (const r of items) {
    const key = String(r[groupField]);
    (byStage.get(key) ?? byStage.set(key, []).get(key)!).push(r);
  }

  async function moveTo(id: string, fromStage: string, toStage: string) {
    if (fromStage === toStage) return;
    const transition = entity.lifecycle?.transitions.find((t) => t.from === fromStage && t.to === toStage);
    if (!transition) {
      toast.error(`Can't move ${fromStage} → ${toStage}`);
      return;
    }
    try {
      await apiFetch(`/entities/${entity.name}/${id}/transitions`, {
        method: "POST",
        body: { action: transition.action },
      });
      toast.success(`Moved to ${toStage}`);
      onMoved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {stages.map((s) => {
        const cards = byStage.get(s.value) ?? [];
        return (
          <div
            key={s.value}
            className="w-64 shrink-0"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              const card = items.find((i) => i.id === id);
              if (card) moveTo(id, String(card[groupField]), s.value);
            }}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <Badge tone={enumTone(field, s.value)}>{s.label}</Badge>
              <span className="text-xs text-muted-2">{cards.length}</span>
            </div>
            <div className="min-h-24 space-y-2 rounded-lg bg-surface-2 p-2">
              {cards.map((c) => (
                <button
                  key={c.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", c.id);
                    setDragId(c.id);
                  }}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => onCardClick(c.id)}
                  className={cn(
                    "block w-full rounded-md border border-border bg-surface p-2.5 text-left text-sm shadow-sm hover:bg-background",
                    dragId === c.id && "opacity-50",
                  )}
                >
                  <div className="truncate font-medium">{String(c[entity.titleField] ?? c.id)}</div>
                  {amountField && (
                    <div className="mt-0.5 text-xs text-muted">
                      {formatValue(amountField, c[amountField.name] ?? null)}
                    </div>
                  )}
                </button>
              ))}
              {cards.length === 0 && <p className="px-1 py-2 text-xs text-muted-2">Drop here</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
