"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EntityRecord } from "@/lib/metadata/types";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

interface CalEvent {
  date: string; // YYYY-MM-DD
  label: string;
  entity: string;
  id: string;
  tone: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TONE_BG: Record<string, string> = {
  task: "bg-info/15 text-info",
  deal: "bg-success/15 text-success",
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarView() {
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);

  useEffect(() => {
    (async () => {
      const [tasks, deals] = await Promise.all([
        apiFetch<{ items: EntityRecord[] }>(`/entities/task?pageSize=200`),
        apiFetch<{ items: EntityRecord[] }>(`/entities/deal?pageSize=200`),
      ]);
      const evs: CalEvent[] = [];
      for (const t of tasks.items) {
        if (typeof t.dueDate === "string" && t.dueDate)
          evs.push({ date: t.dueDate.slice(0, 10), label: String(t.subject ?? "Task"), entity: "task", id: t.id, tone: "task" });
      }
      for (const d of deals.items) {
        if (typeof d.closeDate === "string" && d.closeDate)
          evs.push({ date: d.closeDate.slice(0, 10), label: String(d.name ?? "Deal"), entity: "deal", id: d.id, tone: "deal" });
      }
      setEvents(evs);
    })().catch(() => undefined);
  }, []);

  // Build a 6-week grid starting on Sunday.
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return d;
  });
  const byDate = new Map<string, CalEvent[]>();
  for (const e of events) (byDate.get(e.date) ?? byDate.set(e.date, []).get(e.date)!).push(e);

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayKey = ymd(today);

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Calendar</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => shift(-1)} aria-label="Previous month">
            <Icon name="chevronLeft" />
          </Button>
          <span className="min-w-36 text-center text-sm font-medium">{monthLabel}</span>
          <Button size="sm" onClick={() => shift(1)} aria-label="Next month">
            <Icon name="chevronRight" />
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setYear(today.getFullYear());
              setMonth(today.getMonth());
            }}
          >
            Today
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-surface-2 text-xs font-medium text-muted">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2 py-1.5">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const key = ymd(d);
            const inMonth = d.getMonth() === month;
            const dayEvents = byDate.get(key) ?? [];
            return (
              <div
                key={i}
                className={cn(
                  "min-h-24 border-b border-r border-border p-1.5 last:border-r-0",
                  !inMonth && "bg-surface-2/40 text-muted-2",
                )}
              >
                <div className={cn("mb-1 text-xs", key === todayKey && "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground")}>
                  {d.getDate()}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((e) => (
                    <button
                      key={`${e.entity}-${e.id}`}
                      onClick={() => router.push(`/${e.entity}?focus=${e.id}`)}
                      className={cn("block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px]", TONE_BG[e.tone])}
                      title={e.label}
                    >
                      {e.label}
                    </button>
                  ))}
                  {dayEvents.length > 3 && <p className="px-1 text-[10px] text-muted-2">+{dayEvents.length - 3} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
