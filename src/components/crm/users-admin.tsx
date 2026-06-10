"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  positionId: string;
  managerId: string;
  phone: string;
  jobTitle: string;
  active: boolean;
  twoFactorEnabled: boolean;
}
export interface PositionOption {
  id: string;
  name: string;
}

interface EditDraft {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  jobTitle: string;
}

/** Admin screen: create/edit users, assign positions + managers, reset passwords
 *  and two-factor, enable/disable — all persisted to the DB. */
export function UsersAdmin({ initial, positions }: { initial: UserRecord[]; positions: PositionOption[] }) {
  const { t } = useI18n();
  const [users, setUsers] = useState<UserRecord[]>(initial);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EditDraft | null>(null);
  // create form
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [positionId, setPositionId] = useState(positions[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  const positionName = (id: string) => positions.find((p) => p.id === id)?.name ?? "—";
  const userName = (id: string) => users.find((u) => u.id === id)?.displayName ?? "—";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, query]);

  function fail(e: unknown) {
    toast.error(e instanceof ApiRequestError ? e.message : t("settings.users.somethingWrong"));
  }
  function mergeUser(id: string, raw: Record<string, unknown>) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              email: String(raw.email ?? u.email),
              displayName: String(raw.displayName ?? u.displayName),
              positionId: String(raw.positionId ?? u.positionId),
              managerId: raw.managerId ? String(raw.managerId) : "",
              phone: (raw.phone as string | null) ?? "",
              jobTitle: (raw.jobTitle as string | null) ?? "",
              active: raw.active !== false,
              twoFactorEnabled: Boolean(raw.twoFactorEnabled),
            }
          : u,
      ),
    );
  }

  function create() {
    if (!email.trim() || !password || !positionId) {
      toast.error(t("settings.users.errRequired"));
      return;
    }
    startTransition(async () => {
      try {
        const created = await apiFetch<Record<string, unknown>>("/admin/users", {
          method: "POST",
          body: { email: email.trim(), displayName: displayName.trim() || email.trim(), password, positionId, active: true },
        });
        setUsers((prev) => [
          ...prev,
          {
            id: String(created.id),
            email: String(created.email ?? ""),
            displayName: String(created.displayName ?? ""),
            positionId: String(created.positionId ?? ""),
            managerId: created.managerId ? String(created.managerId) : "",
            phone: (created.phone as string | null) ?? "",
            jobTitle: (created.jobTitle as string | null) ?? "",
            active: created.active !== false,
            twoFactorEnabled: Boolean(created.twoFactorEnabled),
          },
        ]);
        setEmail("");
        setDisplayName("");
        setPassword("");
        setCreating(false);
        toast.success(t("settings.users.created"));
      } catch (e) {
        fail(e);
      }
    });
  }

  function patch(id: string, body: Record<string, unknown>, msg: string) {
    startTransition(async () => {
      try {
        const updated = await apiFetch<Record<string, unknown>>(`/admin/users/${id}`, { method: "PATCH", body });
        mergeUser(id, updated);
        toast.success(msg);
      } catch (e) {
        fail(e);
      }
    });
  }

  function saveEdit() {
    if (!editing) return;
    if (!editing.displayName.trim() || !editing.email.trim()) {
      toast.error(t("settings.users.errRequired"));
      return;
    }
    const id = editing.id;
    const body = {
      displayName: editing.displayName.trim(),
      email: editing.email.trim(),
      phone: editing.phone.trim() || null,
      jobTitle: editing.jobTitle.trim() || null,
    };
    startTransition(async () => {
      try {
        const updated = await apiFetch<Record<string, unknown>>(`/admin/users/${id}`, { method: "PATCH", body });
        mergeUser(id, updated);
        setEditing(null);
        toast.success(t("settings.users.saved"));
      } catch (e) {
        fail(e);
      }
    });
  }

  function resetPassword(u: UserRecord) {
    const pw = window.prompt(t("settings.users.resetPrompt", { name: u.displayName }));
    if (!pw) return;
    patch(u.id, { password: pw }, t("settings.users.passwordReset"));
  }
  function reset2fa(u: UserRecord) {
    if (!window.confirm(t("settings.users.reset2faConfirm", { name: u.displayName }))) return;
    patch(u.id, { resetTwoFactor: true }, t("settings.users.twoFactorReset"));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/settings" className="text-xs font-medium text-primary hover:underline">
            <Icon name="chevronLeft" className="inline h-3.5 w-3.5" /> {t("settings.allSettings")}
          </Link>
          <h1 className="mt-0.5 text-lg font-semibold">{t("settings.users.title")}</h1>
          <p className="text-xs text-muted">{t("settings.users.subtitle")}</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => { setCreating((v) => !v); setEditing(null); }} disabled={pending}>
          {t("settings.users.newUser")}
        </Button>
      </div>

      {creating && (
        <Card>
          <CardHeader title={t("settings.users.newUser")} />
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("settings.users.phEmail")} type="email" />
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t("settings.users.phName")} />
              <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("settings.users.phPassword")} type="password" />
              <Select value={positionId} onChange={(e) => setPositionId(e.target.value)}>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setCreating(false)} disabled={pending}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" size="sm" onClick={create} disabled={pending}>
                {t("common.create")}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {editing && (
        <Card>
          <CardHeader title={t("settings.users.editUser")} />
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label>{t("settings.users.colName")}</Label>
                <Input value={editing.displayName} onChange={(e) => setEditing({ ...editing, displayName: e.target.value })} />
              </div>
              <div>
                <Label>{t("settings.users.colEmail")}</Label>
                <Input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </div>
              <div>
                <Label>{t("settings.users.phone")}</Label>
                <Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </div>
              <div>
                <Label>{t("settings.users.jobTitle")}</Label>
                <Input value={editing.jobTitle} onChange={(e) => setEditing({ ...editing, jobTitle: e.target.value })} />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(null)} disabled={pending}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" size="sm" onClick={saveEdit} disabled={pending}>
                {t("common.save")}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="relative max-w-xs">
        <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("settings.users.search")} className="pl-8" />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-2">
              <th className="px-4 py-2.5">{t("settings.users.colName")}</th>
              <th className="px-4 py-2.5">{t("settings.users.colEmail")}</th>
              <th className="px-4 py-2.5">{t("settings.users.colPosition")}</th>
              <th className="px-4 py-2.5">{t("settings.users.colManager")}</th>
              <th className="px-4 py-2.5">{t("settings.users.col2fa")}</th>
              <th className="px-4 py-2.5">{t("settings.users.colStatus")}</th>
              <th className="px-4 py-2.5 text-right">{t("settings.users.colActions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-surface-2">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{u.displayName}</div>
                  {u.jobTitle && <div className="text-xs text-muted">{u.jobTitle}</div>}
                </td>
                <td className="px-4 py-3 text-muted">{u.email}</td>
                <td className="px-4 py-3">
                  <Select value={u.positionId} onChange={(e) => patch(u.id, { positionId: e.target.value }, t("settings.users.positionUpdated"))} className="h-8 w-40">
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Select value={u.managerId} onChange={(e) => patch(u.id, { managerId: e.target.value || null }, t("settings.users.managerUpdated"))} className="h-8 w-40">
                    <option value="">{t("settings.users.noManager")}</option>
                    {users.filter((m) => m.id !== u.id).map((m) => (
                      <option key={m.id} value={m.id}>{m.displayName}</option>
                    ))}
                  </Select>
                </td>
                <td className="px-4 py-3">
                  {u.twoFactorEnabled ? (
                    <Badge tone="success">{t("settings.on")}</Badge>
                  ) : (
                    <Badge tone="neutral">{t("settings.off")}</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={u.active ? "success" : "neutral"}>{u.active ? t("settings.users.active") : t("settings.users.disabled")}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button variant="ghost" size="xs" onClick={() => { setEditing({ id: u.id, displayName: u.displayName, email: u.email, phone: u.phone, jobTitle: u.jobTitle }); setCreating(false); }}>
                      {t("common.edit")}
                    </Button>
                    <Button variant="ghost" size="xs" onClick={() => patch(u.id, { active: !u.active }, u.active ? t("settings.users.disabled") : t("settings.users.enable"))}>
                      {u.active ? t("settings.users.disable") : t("settings.users.enable")}
                    </Button>
                    <Button variant="ghost" size="xs" onClick={() => resetPassword(u)}>
                      {t("settings.users.resetPassword")}
                    </Button>
                    {u.twoFactorEnabled && (
                      <Button variant="ghost" size="xs" onClick={() => reset2fa(u)}>
                        {t("settings.users.reset2fa")}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  {t("settings.users.none")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
