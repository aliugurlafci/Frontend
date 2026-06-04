"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";

export interface NoteRecord {
  id: string;
  title: string;
  body: string | null;
  updatedAt: string;
  version: number;
}

/** Notes screen backed by the `note` entity (persists to the backend/DB). */
export function NotesBoard({ initial }: { initial: NoteRecord[] }) {
  const [notes, setNotes] = useState<NoteRecord[]>(initial);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function openNew() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setOpen(true);
  }

  function startEdit(n: NoteRecord) {
    setEditingId(n.id);
    setTitle(n.title);
    setBody(n.body ?? "");
    setOpen(true);
  }

  function cancel() {
    setOpen(false);
    setEditingId(null);
    setTitle("");
    setBody("");
  }

  function fail(e: unknown) {
    toast.error(e instanceof ApiRequestError ? e.message : "Something went wrong");
  }

  function save() {
    const t = title.trim();
    const b = body.trim();
    if (!t && !b) return;
    const payload = { title: t || "Untitled", body: b };
    startTransition(async () => {
      try {
        if (editingId) {
          const current = notes.find((n) => n.id === editingId);
          const updated = await apiFetch<NoteRecord>(`/entities/note/${editingId}`, {
            method: "PATCH",
            body: payload,
            headers: current ? { "if-match": String(current.version) } : undefined,
          });
          setNotes((prev) => prev.map((n) => (n.id === editingId ? updated : n)));
        } else {
          const created = await apiFetch<NoteRecord>("/entities/note", { method: "POST", body: payload });
          setNotes((prev) => [created, ...prev]);
        }
        cancel();
      } catch (e) {
        fail(e);
      }
    });
  }

  function remove(n: NoteRecord) {
    startTransition(async () => {
      try {
        await apiFetch(`/entities/note/${n.id}`, { method: "DELETE", headers: { "if-match": String(n.version) } });
        setNotes((prev) => prev.filter((x) => x.id !== n.id));
        if (editingId === n.id) cancel();
      } catch (e) {
        fail(e);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Notes</h1>
          <p className="text-xs text-muted">Jot down ideas and reminders</p>
        </div>
        <Button variant="primary" size="sm" onClick={openNew} disabled={pending}>
          <Icon name="plus" className="h-3.5 w-3.5" />
          New Note
        </Button>
      </div>

      {open && (
        <Card>
          <CardBody className="space-y-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" />
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write something..." />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={cancel} disabled={pending}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={save} disabled={pending}>
                {editingId ? "Update" : "Save"}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {notes.length === 0 && !open ? (
        <p className="text-sm text-muted">No notes yet. Create your first note.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <div
              key={n.id}
              className="group relative rounded-lg border border-l-4 border-border border-l-primary bg-surface p-4 shadow-sm"
            >
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => startEdit(n)}
                  aria-label="Edit note"
                  className="rounded p-1 text-muted-2 hover:bg-surface-2 hover:text-foreground"
                >
                  <Icon name="edit" className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove(n)}
                  aria-label="Delete note"
                  className="rounded p-1 text-muted-2 hover:bg-surface-2 hover:text-danger"
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </div>
              <h2 className="mb-1 pr-12 text-sm font-semibold text-foreground">{n.title}</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{n.body}</p>
              <p className="mt-3 text-xs text-muted-2">{n.updatedAt.slice(0, 10)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
