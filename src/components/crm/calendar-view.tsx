"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EntityRecord } from "@/lib/metadata/types";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { Icon } from "@/components/ui/icon";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

interface CalEvent {
  date: string; // YYYY-MM-DD
  label: string;
  entity: "calendarEvent" | "task" | "deal";
  id: string;
  tone: string;
}

interface EventForm {
  title: string;
  date: string;
  type: string;
  notes: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Colour per event tone (calendarEvent types + the task/deal overlays). */
const TONE_BG: Record<string, string> = {
  task: "bg-info/15 text-info",
  deal: "bg-success/15 text-success",
  event: "bg-secondary/15 text-secondary",
  meeting: "bg-success/15 text-success",
  reminder: "bg-warning/15 text-warning",
  deadline: "bg-danger/15 text-danger",
};

const EVENT_TYPES = [
  { value: "event", label: "Event" },
  { value: "meeting", label: "Meeting" },
  { value: "reminder", label: "Reminder" },
  { value: "deadline", label: "Deadline" },
];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarView({ canManage = false }: { canManage?: boolean }) {
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);
  // calendarEvent records, kept so the editor can be pre-filled on edit.
  const [eventRecords, setEventRecords] = useState<Map<string, EntityRecord>>(new Map());

  const [editor, setEditor] = useState<{ mode: "create" | "edit"; id?: string; form: EventForm } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [evResp, tasks, deals] = await Promise.all([
      apiFetch<{ items: EntityRecord[] }>(`/entities/calendarEvent?pageSize=500`).catch(() => ({ items: [] })),
      apiFetch<{ items: EntityRecord[] }>(`/entities/task?pageSize=200`).catch(() => ({ items: [] })),
      apiFetch<{ items: EntityRecord[] }>(`/entities/deal?pageSize=200`).catch(() => ({ items: [] })),
    ]);

    const evs: CalEvent[] = [];
    const records = new Map<string, EntityRecord>();
    for (const e of evResp.items) {
      if (typeof e.date === "string" && e.date) {
        records.set(e.id, e);
        evs.push({
          date: e.date.slice(0, 10),
          label: String(e.title ?? "Event"),
          entity: "calendarEvent",
          id: e.id,
          tone: String(e.type ?? "event"),
        });
      }
    }
    for (const t of tasks.items) {
      if (typeof t.dueDate === "string" && t.dueDate)
        evs.push({ date: t.dueDate.slice(0, 10), label: String(t.subject ?? "Task"), entity: "task", id: t.id, tone: "task" });
    }
    for (const d of deals.items) {
      if (typeof d.closeDate === "string" && d.closeDate)
        evs.push({ date: d.closeDate.slice(0, 10), label: String(d.name ?? "Deal"), entity: "deal", id: d.id, tone: "deal" });
    }
    setEvents(evs);
    setEventRecords(records);
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  // Build a 6-week grid starting on Sunday.
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const byDate = new Map<string, CalEvent[]>();
  for (const e of events) (byDate.get(e.date) ?? byDate.set(e.date, []).get(e.date)!).push(e);

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayKey = ymd(today);

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function openCreate(date?: string) {
    if (!canManage) return;
    setError(null);
    setEditor({ mode: "create", form: { title: "", date: date ?? todayKey, type: "event", notes: "" } });
  }

  function onEventClick(e: CalEvent) {
    if (e.entity === "calendarEvent") {
      if (!canManage) return; // viewers see events but can't edit
      const rec = eventRecords.get(e.id);
      setError(null);
      setEditor({
        mode: "edit",
        id: e.id,
        form: {
          title: String(rec?.title ?? e.label),
          date: String(rec?.date ?? e.date).slice(0, 10),
          type: String(rec?.type ?? "event"),
          notes: String(rec?.notes ?? ""),
        },
      });
      return;
    }
    // task / deal overlays open their own record.
    router.push(`/${e.entity}?focus=${e.id}`);
  }

  async function save() {
    if (!editor) return;
    const { title, date, type, notes } = editor.form;
    if (!title.trim() || !date) {
      setError("Title and date are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = { title: title.trim(), date, type, notes: notes.trim() || null };
      if (editor.mode === "create") {
        await apiFetch(`/entities/calendarEvent`, { method: "POST", body });
      } else {
        await apiFetch(`/entities/calendarEvent/${editor.id}`, { method: "PATCH", body });
      }
      setEditor(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not save the event.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editor?.id) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/entities/calendarEvent/${editor.id}`, { method: "DELETE" });
      setEditor(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not delete the event.");
    } finally {
      setBusy(false);
    }
  }

  function setForm(patch: Partial<EventForm>) {
    setEditor((prev) => (prev ? { ...prev, form: { ...prev.form, ...patch } } : prev));
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
          {canManage && (
            <Button size="sm" variant="primary" onClick={() => openCreate()}>
              + New event
            </Button>
          )}
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
                onClick={canManage ? () => openCreate(key) : undefined}
                className={cn(
                  "group min-h-24 border-b border-r border-border p-1.5 last:border-r-0",
                  !inMonth && "bg-surface-2/40 text-muted-2",
                  canManage && "cursor-pointer transition-colors hover:bg-surface-2/50",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs",
                      key === todayKey && "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {canManage && (
                    <span className="text-sm leading-none text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
                      +
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((e) => (
                    <button
                      key={`${e.entity}-${e.id}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick(e);
                      }}
                      className={cn("block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px]", TONE_BG[e.tone] ?? TONE_BG.event)}
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

      {canManage && editor && (
        <Drawer
          open
          onClose={() => (busy ? undefined : setEditor(null))}
          title={editor.mode === "create" ? "New event" : "Edit event"}
          footer={
            <div className="flex items-center justify-between gap-2">
              {editor.mode === "edit" ? (
                <Button size="sm" variant="danger" onClick={remove} loading={busy}>
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditor(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={save} loading={busy}>
                  Save
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-3">
            {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
            <div>
              <Label htmlFor="ev-title" required>
                Title
              </Label>
              <Input
                id="ev-title"
                value={editor.form.title}
                onChange={(e) => setForm({ title: e.target.value })}
                placeholder="Event title"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="ev-date" required>
                Date
              </Label>
              <Input id="ev-date" type="date" value={editor.form.date} onChange={(e) => setForm({ date: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="ev-type">Type</Label>
              <Select id="ev-type" value={editor.form.type} onChange={(e) => setForm({ type: e.target.value })}>
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ev-notes">Notes</Label>
              <Textarea id="ev-notes" value={editor.form.notes} onChange={(e) => setForm({ notes: e.target.value })} placeholder="Optional notes" />
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
