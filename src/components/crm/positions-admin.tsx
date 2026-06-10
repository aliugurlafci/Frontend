"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

interface ScreenDef {
  key: string;
  label: string;
  group: string;
}
export interface PermCatalog {
  entities: { name: string; label: string; group: string; actions: string[] }[];
  special: string[];
  rolePresets: Record<string, string[]>;
}
export interface PositionRecord {
  id: string;
  name: string;
  role: string;
  description: string | null;
  screens: string[];
  permissions: string[];
  version: number;
}

const CRUD = ["read", "create", "update", "delete"];

interface Draft {
  id: string;
  name: string;
  role: string;
  /** Existing position used as a starting template (UI-only, not persisted). */
  templateId: string;
  description: string;
  screens: string[];
  permissions: string[];
}
const blankDraft = (): Draft => ({ id: "", name: "", role: "sales_rep", templateId: "", description: "", screens: [], permissions: [] });

/** Does the grant set already cover `action` (via `*`, `entity:*`, or the exact grant)? */
function isGranted(set: Set<string>, action: string): boolean {
  if (set.has("*") || set.has(action)) return true;
  const entity = action.split(":")[0];
  return set.has(`${entity}:*`);
}

/**
 * Admin screen: per-position screen access + a detailed operation permission
 * matrix (view/create/edit/delete + lifecycle actions per entity). Persists to DB.
 */
export function PositionsAdmin({
  initial,
  screens,
  groupLabels = {},
  catalog,
}: {
  initial: PositionRecord[];
  screens: ScreenDef[];
  groupLabels?: Record<string, string>;
  catalog: PermCatalog;
}) {
  const { t } = useI18n();
  const [positions, setPositions] = useState<PositionRecord[]>(initial);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();

  const screenGroups = useMemo(() => {
    const byGroup = new Map<string, ScreenDef[]>();
    for (const s of screens) {
      const arr = byGroup.get(s.group) ?? [];
      arr.push(s);
      byGroup.set(s.group, arr);
    }
    return [...byGroup.entries()];
  }, [screens]);

  const entityGroups = useMemo(() => {
    const byGroup = new Map<string, PermCatalog["entities"]>();
    for (const e of catalog.entities) {
      const arr = byGroup.get(e.group) ?? [];
      arr.push(e);
      byGroup.set(e.group, arr);
    }
    return [...byGroup.entries()];
  }, [catalog.entities]);

  const grantSet = useMemo(() => new Set(editing?.permissions ?? []), [editing?.permissions]);
  const isAdminRole = editing?.role === "admin";

  /** A position's effective grants: its explicit permissions, or — when empty —
   *  the grants its base role inherits. Admin is a super-user (no listed grants). */
  function effectivePerms(p: { role: string; permissions: string[] }): string[] {
    if (p.role === "admin") return [];
    return p.permissions.length ? [...p.permissions] : [...(catalog.rolePresets[p.role] ?? [])];
  }

  function fail(e: unknown) {
    toast.error(e instanceof ApiRequestError ? e.message : t("common.error"));
  }
  function startEdit(p: PositionRecord) {
    // Resolve to the effective grants so the matrix shows what the role actually
    // has — and saving makes them explicit (no more silent base-role inheritance).
    setEditing({ id: p.id, name: p.name, role: p.role, templateId: "", description: p.description ?? "", screens: [...p.screens], permissions: effectivePerms(p) });
  }
  function startNew() {
    setEditing(blankDraft());
  }
  function toggleScreen(key: string) {
    setEditing((d) => (d ? { ...d, screens: d.screens.includes(key) ? d.screens.filter((k) => k !== key) : [...d.screens, key] } : d));
  }

  // ---- permission matrix mutations ----
  function setPerms(next: string[]) {
    setEditing((d) => (d ? { ...d, permissions: next } : d));
  }
  function toggleGrant(action: string) {
    setEditing((d) => {
      if (!d) return d;
      const set = new Set(d.permissions);
      if (set.has(action)) set.delete(action);
      else set.add(action);
      return { ...d, permissions: [...set] };
    });
  }
  /** Toggle "all records" (entity:*) — drops the now-redundant per-op grants. */
  function toggleEntityAll(entity: string) {
    setEditing((d) => {
      if (!d) return d;
      const star = `${entity}:*`;
      const set = new Set(d.permissions);
      if (set.has(star)) {
        set.delete(star);
      } else {
        set.add(star);
        for (const k of [...set]) if (k !== star && k.startsWith(`${entity}:`)) set.delete(k);
      }
      return { ...d, permissions: [...set] };
    });
  }
  /** Base the draft on an existing position: load only that position's permission
   *  details (and adopt its base-role category). The saved role stays standalone —
   *  its explicit permissions are authoritative, so it never inherits a base role. */
  function applyTemplate(id: string) {
    setEditing((d) => {
      if (!d) return d;
      if (!id) return { ...d, templateId: "", permissions: [] };
      const tmpl = positions.find((p) => p.id === id);
      if (!tmpl) return { ...d, templateId: id };
      return { ...d, templateId: id, role: tmpl.role, permissions: effectivePerms(tmpl) };
    });
  }

  function save() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) {
      toast.error(t("perm.nameRequired"));
      return;
    }
    const body = {
      name,
      role: editing.role,
      description: editing.description,
      screens: JSON.stringify(editing.screens),
      permissions: JSON.stringify(editing.permissions),
    };
    startTransition(async () => {
      try {
        if (editing.id) {
          const current = positions.find((p) => p.id === editing.id);
          const updated = await apiFetch<PositionApiRecord>(`/entities/position/${editing.id}`, {
            method: "PATCH",
            body,
            headers: current ? { "if-match": String(current.version) } : undefined,
          });
          setPositions((prev) => prev.map((p) => (p.id === editing.id ? toRecord(updated) : p)));
        } else {
          const created = await apiFetch<PositionApiRecord>(`/entities/position`, { method: "POST", body });
          setPositions((prev) => [...prev, toRecord(created)]);
        }
        setEditing(null);
        toast.success(t("perm.saved"));
      } catch (e) {
        fail(e);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t("perm.title")}</h1>
          <p className="text-xs text-muted">{t("perm.subtitle")}</p>
        </div>
        <Button variant="primary" size="sm" onClick={startNew} disabled={pending}>
          {t("perm.newPosition")}
        </Button>
      </div>

      {editing && (
        <Card>
          <CardHeader title={editing.id ? `${t("perm.edit")}: ${editing.name || t("perm.position")}` : t("perm.newPosition")} />
          <CardBody className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium">{t("perm.name")}</span>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder={t("perm.namePlaceholder")} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">{t("perm.template")}</span>
                <Select value={editing.templateId} onChange={(e) => applyTemplate(e.target.value)}>
                  <option value="">{t("perm.templateNone")}</option>
                  {positions
                    .filter((p) => p.role !== "admin" && p.id !== editing.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </Select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">{t("perm.description")}</span>
                <Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </label>
            </div>
            <p className="-mt-3 text-xs text-muted-2">{t("perm.templateHint")}</p>

            {/* ---- Screen access ---- */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("perm.screens")} ({editing.screens.length})</span>
                <div className="flex gap-2">
                  <Button size="xs" variant="ghost" onClick={() => setEditing({ ...editing, screens: screens.map((s) => s.key) })}>
                    {t("perm.selectAll")}
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setEditing({ ...editing, screens: [] })}>
                    {t("perm.clear")}
                  </Button>
                </div>
              </div>
              {screenGroups.map(([group, list]) => (
                <div key={group}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-2">{groupLabels[group] ?? group}</p>
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

            {/* ---- Operation permissions ---- */}
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{t("perm.operations")}</span>
                {!isAdminRole && (
                  <Button size="xs" variant="ghost" onClick={() => setPerms([])}>
                    {t("perm.clearPerms")}
                  </Button>
                )}
              </div>

              {isAdminRole ? (
                <p className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-xs text-foreground">{t("perm.adminFull")}</p>
              ) : (
                <>
                  <p className="text-xs text-muted">{t("perm.matrixHint")}</p>
                  {/* Special (non-entity) grants */}
                  {catalog.special.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {catalog.special.map((g) => (
                        <label key={g} className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-xs">
                          <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={isGranted(grantSet, g)} onChange={() => toggleGrant(g)} />
                          <span>{t(`perm.special.${g.replace(":", "_")}`)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {/* Entity matrix, grouped */}
                  <div className="space-y-3">
                    {entityGroups.map(([group, list]) => (
                      <div key={group}>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-2">{groupLabels[group] ?? group}</p>
                        <div className="overflow-hidden rounded-md border border-border">
                          <table className="w-full text-xs">
                            <thead className="bg-background text-muted-2">
                              <tr>
                                <th className="px-2 py-1.5 text-left font-medium">{t("perm.colEntity")}</th>
                                <th className="px-1 py-1.5 text-center font-medium" title={t("perm.allRecordsHint")}>{t("perm.colAll")}</th>
                                {CRUD.map((op) => (
                                  <th key={op} className="px-1 py-1.5 text-center font-medium">{t(`perm.op.${op}`)}</th>
                                ))}
                                <th className="px-2 py-1.5 text-left font-medium">{t("perm.colActions")}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {list.map((e) => {
                                const star = grantSet.has(`${e.name}:*`);
                                const extras = e.actions.filter((a) => !CRUD.includes(a));
                                return (
                                  <tr key={e.name} className="hover:bg-surface-2">
                                    <td className="px-2 py-1.5 font-medium text-foreground">{e.label}</td>
                                    <td className="px-1 py-1.5 text-center">
                                      <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={star} onChange={() => toggleEntityAll(e.name)} />
                                    </td>
                                    {CRUD.map((op) => (
                                      <td key={op} className="px-1 py-1.5 text-center">
                                        <input
                                          type="checkbox"
                                          className="h-3.5 w-3.5 accent-primary disabled:opacity-40"
                                          checked={isGranted(grantSet, `${e.name}:${op}`)}
                                          disabled={star}
                                          onChange={() => toggleGrant(`${e.name}:${op}`)}
                                        />
                                      </td>
                                    ))}
                                    <td className="px-2 py-1.5">
                                      <div className="flex flex-wrap gap-1.5">
                                        {extras.length === 0 ? (
                                          <span className="text-muted-2">—</span>
                                        ) : (
                                          extras.map((a) => (
                                            <label key={a} className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5">
                                              <input
                                                type="checkbox"
                                                className="h-3 w-3 accent-primary disabled:opacity-40"
                                                checked={isGranted(grantSet, `${e.name}:${a}`)}
                                                disabled={star}
                                                onChange={() => toggleGrant(`${e.name}:${a}`)}
                                              />
                                              <span>{t(`perm.op.${a}`) === `perm.op.${a}` ? a : t(`perm.op.${a}`)}</span>
                                            </label>
                                          ))
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(null)} disabled={pending}>
                {t("perm.cancel")}
              </Button>
              <Button variant="primary" size="sm" onClick={save} disabled={pending}>
                {t("perm.save")}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-2">
              <th className="px-4 py-2.5">{t("perm.colPosition")}</th>
              <th className="px-4 py-2.5">{t("perm.colAccess")}</th>
              <th className="px-4 py-2.5 text-right">{t("perm.colActionsCol")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {positions.map((p) => (
              <tr key={p.id} className="hover:bg-surface-2">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{p.name}</div>
                  {p.description && <div className="text-xs text-muted">{p.description}</div>}
                </td>
                <td className="px-4 py-3 text-muted">
                  {t("perm.screensCount", { n: String(p.screens.length) })}
                  {" · "}
                  {p.role === "admin"
                    ? t("perm.fullAccess")
                    : p.permissions.length > 0
                      ? t("perm.customPerms")
                      : t("perm.rolePerms")}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="xs" onClick={() => startEdit(p)}>
                    {t("perm.editBtn")}
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

interface PositionApiRecord {
  id: string;
  name: string;
  role: string;
  description: string | null;
  screens: string;
  permissions: string | null;
  version: number;
}
function toRecord(r: PositionApiRecord): PositionRecord {
  const parse = (v: unknown): string[] => {
    try {
      const p = JSON.parse(String(v ?? "[]"));
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  };
  return { id: r.id, name: r.name, role: r.role, description: r.description, screens: parse(r.screens), permissions: parse(r.permissions), version: r.version };
}
