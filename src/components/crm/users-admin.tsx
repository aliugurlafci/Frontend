"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  positionId: string;
  active: boolean;
}
export interface PositionOption {
  id: string;
  name: string;
}

/** Admin screen: create users, assign positions, reset passwords (persists to DB). */
export function UsersAdmin({ initial, positions }: { initial: UserRecord[]; positions: PositionOption[] }) {
  const { t } = useI18n();
  const [users, setUsers] = useState<UserRecord[]>(initial);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [positionId, setPositionId] = useState(positions[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  const positionName = (id: string) => positions.find((p) => p.id === id)?.name ?? "—";

  function fail(e: unknown) {
    toast.error(e instanceof ApiRequestError ? e.message : t("settings.users.somethingWrong"));
  }

  function create() {
    if (!email.trim() || !password || !positionId) {
      toast.error(t("settings.users.errRequired"));
      return;
    }
    startTransition(async () => {
      try {
        const created = await apiFetch<UserRecord>("/admin/users", {
          method: "POST",
          body: { email: email.trim(), displayName: displayName.trim() || email.trim(), password, positionId, active: true },
        });
        setUsers((prev) => [...prev, created]);
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
        const updated = await apiFetch<UserRecord>(`/admin/users/${id}`, { method: "PATCH", body });
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
        toast.success(msg);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t("settings.users.title")}</h1>
          <p className="text-xs text-muted">{t("settings.users.subtitle")}</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreating((v) => !v)} disabled={pending}>
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
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
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

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-2">
              <th className="px-4 py-2.5">{t("settings.users.colName")}</th>
              <th className="px-4 py-2.5">{t("settings.users.colEmail")}</th>
              <th className="px-4 py-2.5">{t("settings.users.colPosition")}</th>
              <th className="px-4 py-2.5">{t("settings.users.colStatus")}</th>
              <th className="px-4 py-2.5 text-right">{t("settings.users.colActions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-surface-2">
                <td className="px-4 py-3 font-medium text-foreground">{u.displayName}</td>
                <td className="px-4 py-3 text-muted">{u.email}</td>
                <td className="px-4 py-3">
                  <Select
                    value={u.positionId}
                    onChange={(e) => patch(u.id, { positionId: e.target.value }, t("settings.users.positionUpdated"))}
                    className="h-8 w-44"
                  >
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={u.active ? "success" : "neutral"}>{u.active ? t("settings.users.active") : t("settings.users.disabled")}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="xs" onClick={() => patch(u.id, { active: !u.active }, u.active ? t("settings.users.disabled") : t("settings.users.enable"))}>
                      {u.active ? t("settings.users.disable") : t("settings.users.enable")}
                    </Button>
                    <Button variant="ghost" size="xs" onClick={() => resetPassword(u)}>
                      {t("settings.users.resetPassword")}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
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
