"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n/context";

export interface Recipient {
  id: string;
  name: string;
  email: string;
  type: "contact" | "employee" | "account";
}

type Row = Record<string, unknown>;

const SOURCES: {
  type: Recipient["type"];
  entity: string;
  labelKey: string;
  icon: string;
  name: (r: Row) => string;
}[] = [
  { type: "contact", entity: "contact", labelKey: "email.recipients.contacts", icon: "user", name: (r) => `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() },
  { type: "employee", entity: "employee", labelKey: "email.recipients.employees", icon: "employee", name: (r) => `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() },
  { type: "account", entity: "account", labelKey: "email.recipients.accounts", icon: "building", name: (r) => String(r.name ?? "") },
];

/** Modal to pick one or many recipients from the system's customers, employees and companies. */
export function RecipientPicker({
  open,
  already,
  onClose,
  onAdd,
}: {
  open: boolean;
  already: string[];
  onClose: () => void;
  onAdd: (recipients: Recipient[]) => void;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [all, setAll] = useState<Recipient[]>([]);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [activeType, setActiveType] = useState<Recipient["type"]>("contact");

  useEffect(() => {
    if (!open) return;
    setPicked(new Set());
    setSearch("");
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const results = await Promise.all(
          SOURCES.map((s) =>
            apiFetch<{ items: Row[] }>(`/entities/${s.entity}?pageSize=500`).catch(() => ({ items: [] as Row[] })),
          ),
        );
        if (cancelled) return;
        const list: Recipient[] = [];
        results.forEach((res, i) => {
          const s = SOURCES[i];
          for (const r of res.items) {
            const email = String(r.email ?? "").trim();
            if (!email || !email.includes("@")) continue; // only emailable
            list.push({ id: String(r.id), name: s.name(r) || email, email, type: s.type });
          }
        });
        setAll(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const alreadySet = useMemo(() => new Set(already.map((e) => e.toLowerCase())), [already]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((r) => r.type === activeType && (!q || `${r.name} ${r.email}`.toLowerCase().includes(q)));
  }, [all, activeType, search]);

  const countByType = (type: Recipient["type"]) => all.filter((r) => r.type === type).length;

  if (!open) return null;

  function toggle(email: string) {
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(email)) n.delete(email);
      else n.add(email);
      return n;
    });
  }

  function confirm() {
    onAdd(all.filter((r) => picked.has(r.email)));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("email.recipients.title")}
        className="relative flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-surface shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">{t("email.recipients.title")}</h2>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 border-b border-border p-3">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("email.recipients.search")}
              className="h-8 pl-8"
            />
          </div>
          <div className="flex gap-1">
            {SOURCES.map((s) => (
              <button
                key={s.type}
                onClick={() => setActiveType(s.type)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  activeType === s.type ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-2",
                )}
              >
                <Icon name={s.icon} className="h-3.5 w-3.5" />
                {t(s.labelKey)}
                <span className="text-muted-2">{countByType(s.type)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5">
          {loading ? (
            <p className="p-4 text-sm text-muted">{t("common.loading")}</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted">{t("email.recipients.none")}</p>
          ) : (
            filtered.map((r) => {
              const isAlready = alreadySet.has(r.email.toLowerCase());
              const checked = picked.has(r.email) || isAlready;
              return (
                <button
                  key={`${r.type}:${r.id}`}
                  onClick={() => !isAlready && toggle(r.email)}
                  disabled={isAlready}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                    isAlready ? "opacity-50" : "hover:bg-surface-2",
                  )}
                >
                  <span
                    className={cn(
                      "h-4 w-4 shrink-0 rounded border",
                      checked ? "border-primary bg-primary" : "border-border-strong",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{r.name}</p>
                    <p className="truncate text-xs text-muted">{r.email}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border p-3">
          <span className="text-xs text-muted">{t("email.recipients.selected", { n: String(picked.size) })}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" size="sm" onClick={confirm} disabled={picked.size === 0}>
              <Icon name="plus" className="h-3.5 w-3.5" />
              {t("email.recipients.add")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
