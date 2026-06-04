"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ScreenDef {
  key: string;
  label: string;
  group: string;
}
export interface PositionRecord {
  id: string;
  name: string;
  role: string;
  description: string | null;
  screens: string[];
  version: number;
}

const ROLES = [
  { value: "admin", label: "Administrator" },
  { value: "sales_manager", label: "Sales Manager" },
  { value: "sales_rep", label: "Sales Rep" },
  { value: "accountant", label: "Accountant" },
];

const blankDraft = () => ({ id: "", name: "", role: "sales_rep", description: "", screens: [] as string[] });

/** Admin screen: define which screens each position can access (persists to DB). */
export function PositionsAdmin({ initial, screens }: { initial: PositionRecord[]; screens: ScreenDef[] }) {
  const [positions, setPositions] = useState<PositionRecord[]>(initial);
  const [editing, setEditing] = useState<{ id: string; name: string; role: string; description: string; screens: string[] } | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => {
    const byGroup = new Map<string, ScreenDef[]>();
    for (const s of screens) {
      const arr = byGroup.get(s.group) ?? [];
      arr.push(s);
      byGroup.set(s.group, arr);
    }
    return [...byGroup.entries()];
  }, [screens]);

  function fail(e: unknown) {
    toast.error(e instanceof ApiRequestError ? e.message : "Something went wrong");
  }

  function startEdit(p: PositionRecord) {
    setEditing({ id: p.id, name: p.name, role: p.role, description: p.description ?? "", screens: [...p.screens] });
  }
  function startNew() {
    setEditing(blankDraft());
  }
  function toggleScreen(key: string) {
    setEditing((d) => (d ? { ...d, screens: d.screens.includes(key) ? d.screens.filter((k) => k !== key) : [...d.screens, key] } : d));
  }

  function save() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    const body = { name, role: editing.role, description: editing.description, screens: JSON.stringify(editing.screens) };
    startTransition(async () => {
      try {
        if (editing.id) {
          const current = positions.find((p) => p.id === editing.id);
          const updated = await apiFetch<{ id: string; name: string; role: string; description: string | null; screens: string; version: number }>(
            `/entities/position/${editing.id}`,
            { method: "PATCH", body, headers: current ? { "if-match": String(current.version) } : undefined },
          );
          setPositions((prev) => prev.map((p) => (p.id === editing.id ? toRecord(updated) : p)));
        } else {
          const created = await apiFetch<{ id: string; name: string; role: string; description: string | null; screens: string; version: number }>(
            `/entities/position`,
            { method: "POST", body },
          );
          setPositions((prev) => [...prev, toRecord(created)]);
        }
        setEditing(null);
        toast.success("Saved");
      } catch (e) {
        fail(e);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Positions &amp; Screen Access</h1>
          <p className="text-xs text-muted">Define which screens each position can open. Stored in the database.</p>
        </div>
        <Button variant="primary" size="sm" onClick={startNew} disabled={pending}>
          New position
        </Button>
      </div>

      {editing && (
        <Card>
          <CardHeader title={editing.id ? `Edit: ${editing.name || "position"}` : "New position"} />
          <CardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Name</span>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Support Lead" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Base role (data permissions)</span>
                <Select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Description</span>
                <Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Screens ({editing.screens.length})</span>
                <div className="flex gap-2">
                  <Button size="xs" variant="ghost" onClick={() => setEditing({ ...editing, screens: screens.map((s) => s.key) })}>
                    Select all
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setEditing({ ...editing, screens: [] })}>
                    Clear
                  </Button>
                </div>
              </div>
              {groups.map(([group, list]) => (
                <div key={group}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-2">{group}</p>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                    {list.map((s) => (
                      <label key={s.key} className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-xs">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-primary"
                          checked={editing.screens.includes(s.key)}
                          onChange={() => toggleScreen(s.key)}
                        />
                        <span className="truncate">{s.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(null)} disabled={pending}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={save} disabled={pending}>
                Save
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-2">
              <th className="px-4 py-2.5">Position</th>
              <th className="px-4 py-2.5">Base role</th>
              <th className="px-4 py-2.5">Screens</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {positions.map((p) => (
              <tr key={p.id} className="hover:bg-surface-2">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{p.name}</div>
                  {p.description && <div className="text-xs text-muted">{p.description}</div>}
                </td>
                <td className="px-4 py-3">
                  <Badge tone="info">{p.role}</Badge>
                </td>
                <td className="px-4 py-3 text-muted">{p.screens.length} screens</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="xs" onClick={() => startEdit(p)}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function toRecord(r: { id: string; name: string; role: string; description: string | null; screens: string; version: number }): PositionRecord {
  let screens: string[] = [];
  try {
    const parsed = JSON.parse(r.screens ?? "[]");
    if (Array.isArray(parsed)) screens = parsed.map(String);
  } catch {
    /* ignore */
  }
  return { id: r.id, name: r.name, role: r.role, description: r.description, screens, version: r.version };
}
