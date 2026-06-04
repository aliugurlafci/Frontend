"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge, type Tone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

type Priority = "high" | "medium" | "low";
type FilterId = "all" | "active" | "completed";

export interface TodoRecord {
  id: string;
  title: string;
  priority: Priority;
  dueDate: string | null;
  done: boolean;
  version: number;
}

const PRIORITY_TONE: Record<Priority, Tone> = { high: "danger", medium: "warning", low: "info" };

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
];

/** To-Do screen backed by the `todo` entity (persists to the backend/DB). */
export function TodoBoard({ initial }: { initial: TodoRecord[] }) {
  const [todos, setTodos] = useState<TodoRecord[]>(initial);
  const [filter, setFilter] = useState<FilterId>("all");
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("medium");
  const [pending, startTransition] = useTransition();

  function fail(e: unknown) {
    toast.error(e instanceof ApiRequestError ? e.message : "Something went wrong");
  }

  /** Replace a todo in-place with the server's authoritative copy. */
  function patch(id: string, body: Record<string, unknown>) {
    const current = todos.find((t) => t.id === id);
    return apiFetch<TodoRecord>(`/entities/todo/${id}`, {
      method: "PATCH",
      body,
      headers: current ? { "if-match": String(current.version) } : undefined,
    });
  }

  function add() {
    const title = draft.trim();
    if (!title) return;
    startTransition(async () => {
      try {
        const created = await apiFetch<TodoRecord>("/entities/todo", {
          method: "POST",
          body: { title, priority: "medium", done: false },
        });
        setTodos((prev) => [...prev, created]);
        setDraft("");
      } catch (e) {
        fail(e);
      }
    });
  }

  function toggle(t: TodoRecord) {
    startTransition(async () => {
      try {
        const updated = await patch(t.id, { done: !t.done });
        setTodos((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
      } catch (e) {
        fail(e);
      }
    });
  }

  function remove(t: TodoRecord) {
    startTransition(async () => {
      try {
        await apiFetch(`/entities/todo/${t.id}`, { method: "DELETE", headers: { "if-match": String(t.version) } });
        setTodos((prev) => prev.filter((x) => x.id !== t.id));
        if (editingId === t.id) setEditingId(null);
      } catch (e) {
        fail(e);
      }
    });
  }

  function startEdit(t: TodoRecord) {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditPriority(t.priority);
  }

  function saveEdit() {
    const title = editTitle.trim();
    if (!title || !editingId) return;
    const id = editingId;
    startTransition(async () => {
      try {
        const updated = await patch(id, { title, priority: editPriority });
        setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
        setEditingId(null);
      } catch (e) {
        fail(e);
      }
    });
  }

  const visible = todos.filter((t) => (filter === "all" ? true : filter === "active" ? !t.done : t.done));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">To Do</h1>
        <p className="text-xs text-muted">Keep track of your tasks and priorities</p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a new task..." />
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          Add
        </Button>
      </form>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:bg-surface-2",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {visible.length === 0 ? (
          <EmptyState icon="todo" title="No tasks" description="You're all caught up here." />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((t) =>
              editingId === t.id ? (
                <li key={t.id} className="flex items-center gap-2 px-4 py-2.5">
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="flex-1" autoFocus />
                  <Select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as Priority)}
                    className="w-28"
                  >
                    <option value="high">high</option>
                    <option value="medium">medium</option>
                    <option value="low">low</option>
                  </Select>
                  <Button variant="primary" size="sm" onClick={saveEdit} disabled={pending}>
                    Save
                  </Button>
                  <Button size="sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </li>
              ) : (
                <li key={t.id} className="group flex items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => toggle(t)}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                  />
                  <span className={cn("flex-1 text-sm", t.done ? "text-muted line-through" : "text-foreground")}>
                    {t.title}
                  </span>
                  <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                  <span className="text-xs text-muted-2">{t.dueDate ?? "—"}</span>
                  <button
                    onClick={() => startEdit(t)}
                    aria-label="Edit task"
                    className="rounded p-1 text-muted-2 opacity-0 transition-opacity hover:bg-surface-2 hover:text-foreground group-hover:opacity-100"
                  >
                    <Icon name="edit" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => remove(t)}
                    aria-label="Delete task"
                    className="rounded p-1 text-muted-2 opacity-0 transition-opacity hover:bg-surface-2 hover:text-danger group-hover:opacity-100"
                  >
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}
