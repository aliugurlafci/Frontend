"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { EntityRecord } from "@/lib/metadata/types";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
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
  /** HH:MM for timed events — drives ordering inside a day. */
  time: string;
  done: boolean;
}

interface EventForm {
  title: string;
  date: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  type: string;
  status: string;
  priority: string;
  location: string;
  attendees: string[];
  ownerUserId: string;
  relatedEntity: string;
  relatedId: string;
  reminderMinutes: string;
  notes: string;
}

const emptyForm = (date: string): EventForm => ({
  title: "",
  date,
  endDate: "",
  allDay: true,
  startTime: "",
  endTime: "",
  type: "event",
  status: "planned",
  priority: "normal",
  location: "",
  attendees: [],
  ownerUserId: "",
  relatedEntity: "",
  relatedId: "",
  reminderMinutes: "",
  notes: "",
});

/** Colour per event tone (calendarEvent types + the task/deal overlays). */
const TONE_BG: Record<string, string> = {
  task: "bg-info/15 text-info",
  deal: "bg-success/15 text-success",
  event: "bg-secondary/15 text-secondary",
  meeting: "bg-success/15 text-success",
  reminder: "bg-warning/15 text-warning",
  deadline: "bg-danger/15 text-danger",
};

const EVENT_TYPES = ["event", "meeting", "reminder", "deadline"];
const EVENT_STATUSES = ["planned", "done", "cancelled"];
const EVENT_PRIORITIES = ["low", "normal", "high", "urgent"];
const REMINDERS = ["", "10", "30", "60", "1440"];

/** How many events a day cell lists before collapsing into "+N more". */
const VISIBLE_PER_DAY = 4;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Every date from `start` to `end` inclusive (multi-day events fill the span). */
function dateRange(start: string, end: string): string[] {
  if (!end || end <= start) return [start];
  const out: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  // Guard against a runaway range from bad data.
  for (let i = 0; cursor <= last && i < 366; i++) {
    out.push(ymd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function parseAttendees(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export interface CalendarUser {
  id: string;
  name: string;
}
/** An entity an event can be linked to, labelled in the active language. */
export interface RelatedEntityOption {
  name: string;
  label: string;
}

export function CalendarView({
  canManage = false,
  users = [],
  relatedEntities = [],
}: {
  canManage?: boolean;
  users?: CalendarUser[];
  relatedEntities?: RelatedEntityOption[];
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);
  // calendarEvent records, kept so the editor can be pre-filled on edit.
  const [eventRecords, setEventRecords] = useState<Map<string, EntityRecord>>(new Map());
  /** The day whose full event list is expanded (from "+N more"). */
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

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
      if (typeof e.date !== "string" || !e.date) continue;
      records.set(e.id, e);
      const start = e.date.slice(0, 10);
      const end = typeof e.endDate === "string" ? e.endDate.slice(0, 10) : "";
      for (const day of dateRange(start, end)) {
        evs.push({
          date: day,
          label: String(e.title ?? t("calendar.untitled")),
          entity: "calendarEvent",
          id: e.id,
          tone: String(e.type ?? "event"),
          time: e.allDay === false ? String(e.startTime ?? "") : "",
          done: String(e.status ?? "") === "done",
        });
      }
    }
    for (const task of tasks.items) {
      if (typeof task.dueDate === "string" && task.dueDate)
        evs.push({
          date: task.dueDate.slice(0, 10),
          label: String(task.subject ?? t("calendar.untitled")),
          entity: "task",
          id: task.id,
          tone: "task",
          time: "",
          done: false,
        });
    }
    for (const d of deals.items) {
      if (typeof d.closeDate === "string" && d.closeDate)
        evs.push({
          date: d.closeDate.slice(0, 10),
          label: String(d.name ?? t("calendar.untitled")),
          entity: "deal",
          id: d.id,
          tone: "deal",
          time: "",
          done: false,
        });
    }
    setEvents(evs);
    setEventRecords(records);
  }, [t]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  // Build a 6-week grid starting on Sunday.
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));

  // Group by day, timed events first (in clock order), then all-day ones.
  const byDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.time && b.time) return a.time.localeCompare(b.time);
        if (a.time) return -1;
        if (b.time) return 1;
        return a.label.localeCompare(b.label);
      });
    }
    return map;
  }, [events]);

  const weekdays = useMemo(() => {
    // Localized weekday initials, Sunday-first to match the grid.
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 8, 1 + i)));
  }, [locale]);

  const monthLabel = new Date(year, month, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
  const todayKey = ymd(today);

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function openCreate(date?: string) {
    if (!canManage) return;
    setError(null);
    setEditor({ mode: "create", form: emptyForm(date ?? todayKey) });
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
          endDate: rec?.endDate ? String(rec.endDate).slice(0, 10) : "",
          allDay: rec?.allDay !== false,
          startTime: String(rec?.startTime ?? ""),
          endTime: String(rec?.endTime ?? ""),
          type: String(rec?.type ?? "event"),
          status: String(rec?.status ?? "planned"),
          priority: String(rec?.priority ?? "normal"),
          location: String(rec?.location ?? ""),
          attendees: parseAttendees(rec?.attendees),
          ownerUserId: rec?.ownerUserId ? String(rec.ownerUserId) : "",
          relatedEntity: String(rec?.relatedEntity ?? ""),
          relatedId: String(rec?.relatedId ?? ""),
          reminderMinutes: rec?.reminderMinutes != null ? String(rec.reminderMinutes) : "",
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
    const f = editor.form;
    if (!f.title.trim() || !f.date) {
      setError(t("calendar.errRequired"));
      return;
    }
    if (f.endDate && f.endDate < f.date) {
      setError(t("calendar.errEndBeforeStart"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        title: f.title.trim(),
        date: f.date,
        endDate: f.endDate || null,
        allDay: f.allDay,
        startTime: f.allDay ? null : f.startTime || null,
        endTime: f.allDay ? null : f.endTime || null,
        type: f.type,
        status: f.status,
        priority: f.priority,
        location: f.location.trim() || null,
        attendees: f.attendees.length ? JSON.stringify(f.attendees) : null,
        ownerUserId: f.ownerUserId || null,
        relatedEntity: f.relatedEntity || null,
        relatedId: f.relatedId.trim() || null,
        reminderMinutes: f.reminderMinutes ? Number(f.reminderMinutes) : null,
        notes: f.notes.trim() || null,
      };
      if (editor.mode === "create") {
        await apiFetch(`/entities/calendarEvent`, { method: "POST", body });
      } else {
        await apiFetch(`/entities/calendarEvent/${editor.id}`, { method: "PATCH", body });
      }
      setEditor(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t("calendar.saveFailed"));
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
      setError(err instanceof ApiRequestError ? err.message : t("calendar.deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  function setForm(patch: Partial<EventForm>) {
    setEditor((prev) => (prev ? { ...prev, form: { ...prev.form, ...patch } } : prev));
  }

  function toggleAttendee(id: string) {
    setEditor((prev) => {
      if (!prev) return prev;
      const has = prev.form.attendees.includes(id);
      const attendees = has ? prev.form.attendees.filter((a) => a !== id) : [...prev.form.attendees, id];
      return { ...prev, form: { ...prev.form, attendees } };
    });
  }

  /** One event chip in a day cell (or in the expanded day list). */
  const eventChip = (e: CalEvent) => (
    <button
      key={`${e.entity}-${e.id}-${e.date}`}
      onClick={(ev) => {
        ev.stopPropagation();
        onEventClick(e);
      }}
      className={cn(
        "flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px]",
        TONE_BG[e.tone] ?? TONE_BG.event,
        e.done && "line-through opacity-60",
      )}
      title={e.time ? `${e.time} ${e.label}` : e.label}
    >
      {e.time && <span className="shrink-0 font-medium tabular-nums">{e.time}</span>}
      <span className="truncate">{e.label}</span>
    </button>
  );

  const expandedEvents = expandedDay ? (byDate.get(expandedDay) ?? []) : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{t("nav.calendar")}</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => shift(-1)} aria-label={t("calendar.prevMonth")}>
            <Icon name="chevronLeft" />
          </Button>
          <span className="min-w-36 text-center text-sm font-medium">{monthLabel}</span>
          <Button size="sm" onClick={() => shift(1)} aria-label={t("calendar.nextMonth")}>
            <Icon name="chevronRight" />
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setYear(today.getFullYear());
              setMonth(today.getMonth());
            }}
          >
            {t("calendar.today")}
          </Button>
          {canManage && (
            <Button size="sm" variant="primary" onClick={() => openCreate()}>
              {t("calendar.newEvent")}
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-surface-2 text-xs font-medium text-muted">
          {weekdays.map((w) => (
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
                  "group min-h-28 border-b border-r border-border p-1.5 last:border-r-0",
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
                  {dayEvents.slice(0, VISIBLE_PER_DAY).map(eventChip)}
                  {dayEvents.length > VISIBLE_PER_DAY && (
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setExpandedDay(key);
                      }}
                      className="px-1 text-[10px] text-muted-2 hover:text-foreground hover:underline"
                    >
                      {t("calendar.moreEvents", { n: String(dayEvents.length - VISIBLE_PER_DAY) })}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* All events of one day, when a cell overflows. */}
      {expandedDay && (
        <Drawer
          open
          onClose={() => setExpandedDay(null)}
          title={new Date(`${expandedDay}T00:00:00`).toLocaleDateString(locale, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          footer={
            canManage ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  const day = expandedDay;
                  setExpandedDay(null);
                  openCreate(day);
                }}
              >
                {t("calendar.newEvent")}
              </Button>
            ) : undefined
          }
        >
          <div className="space-y-1.5">
            {expandedEvents.length === 0 ? (
              <p className="text-sm text-muted">{t("calendar.noEvents")}</p>
            ) : (
              expandedEvents.map(eventChip)
            )}
          </div>
        </Drawer>
      )}

      {canManage && editor && (
        <Drawer
          open
          onClose={() => (busy ? undefined : setEditor(null))}
          title={editor.mode === "create" ? t("calendar.newEvent") : t("calendar.editEvent")}
          footer={
            <div className="flex items-center justify-between gap-2">
              {editor.mode === "edit" ? (
                <Button size="sm" variant="danger" onClick={remove} loading={busy}>
                  {t("common.delete")}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditor(null)} disabled={busy}>
                  {t("common.cancel")}
                </Button>
                <Button size="sm" variant="primary" onClick={save} loading={busy}>
                  {t("common.save")}
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-3">
            {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

            <div>
              <Label htmlFor="ev-title" required>
                {t("calendar.title")}
              </Label>
              <Input
                id="ev-title"
                value={editor.form.title}
                onChange={(e) => setForm({ title: e.target.value })}
                placeholder={t("calendar.titlePlaceholder")}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ev-date" required>
                  {t("calendar.date")}
                </Label>
                <Input id="ev-date" type="date" value={editor.form.date} onChange={(e) => setForm({ date: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ev-end-date">{t("calendar.endDate")}</Label>
                <Input id="ev-end-date" type="date" value={editor.form.endDate} onChange={(e) => setForm({ endDate: e.target.value })} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={editor.form.allDay}
                onChange={(e) => setForm({ allDay: e.target.checked })}
              />
              {t("calendar.allDay")}
            </label>

            {!editor.form.allDay && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ev-start">{t("calendar.startTime")}</Label>
                  <Input id="ev-start" type="time" value={editor.form.startTime} onChange={(e) => setForm({ startTime: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="ev-end">{t("calendar.endTime")}</Label>
                  <Input id="ev-end" type="time" value={editor.form.endTime} onChange={(e) => setForm({ endTime: e.target.value })} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ev-type">{t("calendar.type")}</Label>
                <Select id="ev-type" value={editor.form.type} onChange={(e) => setForm({ type: e.target.value })}>
                  {EVENT_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {t(`calendar.type.${v}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="ev-priority">{t("calendar.priority")}</Label>
                <Select id="ev-priority" value={editor.form.priority} onChange={(e) => setForm({ priority: e.target.value })}>
                  {EVENT_PRIORITIES.map((v) => (
                    <option key={v} value={v}>
                      {t(`calendar.priority.${v}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="ev-status">{t("calendar.status")}</Label>
                <Select id="ev-status" value={editor.form.status} onChange={(e) => setForm({ status: e.target.value })}>
                  {EVENT_STATUSES.map((v) => (
                    <option key={v} value={v}>
                      {t(`calendar.status.${v}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="ev-reminder">{t("calendar.reminder")}</Label>
                <Select id="ev-reminder" value={editor.form.reminderMinutes} onChange={(e) => setForm({ reminderMinutes: e.target.value })}>
                  {REMINDERS.map((v) => (
                    <option key={v || "none"} value={v}>
                      {v ? t(`calendar.reminder.${v}`) : t("calendar.reminder.none")}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="ev-location">{t("calendar.location")}</Label>
              <Input
                id="ev-location"
                value={editor.form.location}
                onChange={(e) => setForm({ location: e.target.value })}
                placeholder={t("calendar.locationPlaceholder")}
              />
            </div>

            <div>
              <Label htmlFor="ev-owner">{t("calendar.owner")}</Label>
              <Select id="ev-owner" value={editor.form.ownerUserId} onChange={(e) => setForm({ ownerUserId: e.target.value })}>
                <option value="">{t("common.none")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>

            {users.length > 0 && (
              <div>
                <Label>{t("calendar.attendees")}</Label>
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {users.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-primary"
                        checked={editor.form.attendees.includes(u.id)}
                        onChange={() => toggleAttendee(u.id)}
                      />
                      <span className="truncate">{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ev-rel-entity">{t("calendar.relatedTo")}</Label>
                <Select
                  id="ev-rel-entity"
                  value={editor.form.relatedEntity}
                  onChange={(e) => setForm({ relatedEntity: e.target.value, relatedId: "" })}
                >
                  <option value="">{t("common.none")}</option>
                  {relatedEntities.map((e) => (
                    <option key={e.name} value={e.name}>
                      {e.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="ev-rel-id">{t("calendar.relatedId")}</Label>
                <Input
                  id="ev-rel-id"
                  value={editor.form.relatedId}
                  disabled={!editor.form.relatedEntity}
                  onChange={(e) => setForm({ relatedId: e.target.value })}
                  placeholder={t("calendar.relatedIdPlaceholder")}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="ev-notes">{t("calendar.notes")}</Label>
              <Textarea
                id="ev-notes"
                value={editor.form.notes}
                onChange={(e) => setForm({ notes: e.target.value })}
                placeholder={t("calendar.notesPlaceholder")}
              />
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
