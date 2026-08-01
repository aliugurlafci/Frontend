"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface MobileScreen {
  key: string;
  label: string;
  group: string;
  mobileImplemented: boolean;
}
export interface MobileConfigRow {
  id: string;
  clientId: string;
  positionId: string | null;
  userId: string | null;
  screens: string[];
  hiddenFields: Record<string, string[]>;
  active: boolean;
  version: number;
  updatedAt: string;
}
export interface NamedRef {
  id: string;
  name: string;
}

type Scope = "global" | "position" | "user";
interface Draft {
  id: string;
  clientId: string;
  scope: Scope;
  positionId: string;
  userId: string;
  screens: string[];
  active: boolean;
}

const blankDraft = (mobileSet: string[]): Draft => ({
  id: "",
  clientId: "*",
  scope: "global",
  positionId: "",
  userId: "",
  screens: [...mobileSet],
  active: true,
});

/**
 * Admin screen: which destinations the companion mobile app shows, scoped per
 * client / position / user. The mobile app always intersects these with the
 * user's own screen permissions, so enabling a screen here never widens access.
 */
export function MobileScreensAdmin({
  initial,
  screens,
  groupLabels = {},
  positions,
  users,
  canCreate = true,
  canUpdate = true,
  canDelete = true,
}: {
  initial: MobileConfigRow[];
  screens: MobileScreen[];
  groupLabels?: Record<string, string>;
  positions: NamedRef[];
  users: NamedRef[];
  /** `settings.mobile:create` / `:update` / `:delete` from the permission matrix. */
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}) {
  const { t } = useI18n();
  const [rows, setRows] = useState<MobileConfigRow[]>(initial);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();

  const mobileSet = useMemo(() => screens.filter((s) => s.mobileImplemented).map((s) => s.key), [screens]);
  const screenGroups = useMemo(() => {
    const byGroup = new Map<string, MobileScreen[]>();
    for (const s of screens) {
      const arr = byGroup.get(s.group) ?? [];
      arr.push(s);
      byGroup.set(s.group, arr);
    }
    return [...byGroup.entries()];
  }, [screens]);
  const positionName = (id: string) => positions.find((p) => p.id === id)?.name ?? id;
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? id;

  function fail(e: unknown) {
    toast.error(e instanceof ApiRequestError ? e.message : t("common.error"));
  }
  function startNew() {
    setEditing(blankDraft(mobileSet));
  }
  function startEdit(r: MobileConfigRow) {
    setEditing({
      id: r.id,
      clientId: r.clientId || "*",
      scope: r.userId ? "user" : r.positionId ? "position" : "global",
      positionId: r.positionId ?? "",
      userId: r.userId ?? "",
      screens: [...r.screens],
      active: r.active,
    });
  }
  function toggleScreen(key: string) {
    setEditing((d) => (d ? { ...d, screens: d.screens.includes(key) ? d.screens.filter((k) => k !== key) : [...d.screens, key] } : d));
  }

  async function refresh() {
    const { configs } = await apiFetch<{ configs: MobileConfigRow[] }>("/mobile/configs");
    setRows(configs);
  }

  function save() {
    if (!editing) return;
    if (editing.scope === "position" && !editing.positionId) {
      toast.error(t("mobile.position"));
      return;
    }
    if (editing.scope === "user" && !editing.userId) {
      toast.error(t("mobile.user"));
      return;
    }
    const body = {
      clientId: editing.clientId || "*",
      positionId: editing.scope === "position" ? editing.positionId : null,
      userId: editing.scope === "user" ? editing.userId : null,
      screens: editing.screens,
      active: editing.active,
    };
    startTransition(async () => {
      try {
        if (editing.id) {
          await apiFetch(`/mobile/configs/${editing.id}`, { method: "PATCH", body });
        } else {
          await apiFetch(`/mobile/configs`, { method: "POST", body });
        }
        await refresh();
        setEditing(null);
        toast.success(t("mobile.saved"));
      } catch (e) {
        fail(e);
      }
    });
  }

  function remove(r: MobileConfigRow) {
    if (!window.confirm(t("mobile.deleteConfirm"))) return;
    startTransition(async () => {
      try {
        await apiFetch(`/mobile/configs/${r.id}`, { method: "DELETE" });
        await refresh();
        if (editing?.id === r.id) setEditing(null);
        toast.success(t("mobile.deleted"));
      } catch (e) {
        fail(e);
      }
    });
  }

  function scopeLabel(r: MobileConfigRow): string {
    if (r.userId) return `${t("mobile.user")}: ${userName(r.userId)}`;
    if (r.positionId) return `${t("mobile.position")}: ${positionName(r.positionId)}`;
    return t("mobile.scopeGlobal");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t("mobile.title")}</h1>
          <p className="text-xs text-muted">{t("mobile.subtitle")}</p>
        </div>
        {canCreate && (
          <Button variant="primary" size="sm" onClick={startNew} disabled={pending}>
            {t("mobile.newRule")}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-2">{t("mobile.precedenceHint")}</p>

      {editing && (
        <Card>
          <CardHeader title={editing.id ? t("mobile.edit") : t("mobile.newRule")} />
          <CardBody className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium">{t("mobile.client")}</span>
                <Select value={editing.clientId} onChange={(e) => setEditing({ ...editing, clientId: e.target.value })}>
                  <option value="*">{t("mobile.clientAll")}</option>
                  <option value="ios">iOS</option>
                  <option value="android">Android</option>
                </Select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">{t("mobile.scope")}</span>
                <Select value={editing.scope} onChange={(e) => setEditing({ ...editing, scope: e.target.value as Scope })}>
                  <option value="global">{t("mobile.scopeGlobal")}</option>
                  <option value="position">{t("mobile.scopePosition")}</option>
                  <option value="user">{t("mobile.scopeUser")}</option>
                </Select>
              </label>
              {editing.scope === "position" && (
                <label className="text-sm">
                  <span className="mb-1 block font-medium">{t("mobile.position")}</span>
                  <Select value={editing.positionId} onChange={(e) => setEditing({ ...editing, positionId: e.target.value })}>
                    <option value="">—</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
              {editing.scope === "user" && (
                <label className="text-sm">
                  <span className="mb-1 block font-medium">{t("mobile.user")}</span>
                  <Select value={editing.userId} onChange={(e) => setEditing({ ...editing, userId: e.target.value })}>
                    <option value="">—</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {t("mobile.screens")} ({t("mobile.screensSelected", { n: String(editing.screens.length) })})
                </span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-primary"
                      checked={editing.active}
                      onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                    />
                    {t("mobile.active")}
                  </label>
                  <Button size="xs" variant="ghost" onClick={() => setEditing({ ...editing, screens: [...mobileSet] })}>
                    {t("mobile.mobileSet")}
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setEditing({ ...editing, screens: [] })}>
                    {t("mobile.clear")}
                  </Button>
                </div>
              </div>
              {screenGroups.map(([group, list]) => (
                <div key={group}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-2">{groupLabels[group] ?? group}</p>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                    {list.map((s) => (
                      <label
                        key={s.key}
                        className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-xs"
                        title={s.mobileImplemented ? undefined : t("mobile.webOnly")}
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-primary"
                          checked={editing.screens.includes(s.key)}
                          onChange={() => toggleScreen(s.key)}
                        />
                        <span className="truncate">{s.label}</span>
                        {!s.mobileImplemented && <span className="ml-auto shrink-0 text-[10px] text-muted-2">{t("mobile.webOnly")}</span>}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={pending}>
                {t("mobile.cancel")}
              </Button>
              <Button variant="primary" size="sm" onClick={save} disabled={pending}>
                {t("mobile.save")}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="space-y-2">
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{t("mobile.empty")}</p>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                <Badge tone={r.active ? "success" : "neutral"}>{r.active ? t("mobile.active") : t("mobile.inactive")}</Badge>
                <span className="text-sm font-medium">{scopeLabel(r)}</span>
                <Badge tone="info">{r.clientId === "*" ? t("mobile.clientAll") : r.clientId}</Badge>
                <span className="text-xs text-muted">{t("mobile.screensSelected", { n: String(r.screens.length) })}</span>
                <div className="ml-auto flex gap-2">
                  {canUpdate && (
                    <Button size="xs" variant="ghost" onClick={() => startEdit(r)} disabled={pending}>
                      {t("mobile.edit")}
                    </Button>
                  )}
                  {canDelete && (
                    <Button size="xs" variant="ghost" onClick={() => remove(r)} disabled={pending}>
                      {t("mobile.delete")}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
