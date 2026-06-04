"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n/context";

interface Note {
  id: string;
  at: string;
  channel: string;
  subject: string;
  body: string;
  read: boolean;
  /** Deep link to the related screen (set by the backend per event type). */
  href?: string;
  eventType?: string;
}

/** Pick an icon for a notification from its event type, falling back to channel. */
function noteIcon(n: Note): string {
  const e = n.eventType ?? "";
  if (e.startsWith("quote")) return "quote";
  if (e.startsWith("invoice")) return "invoice";
  if (e.startsWith("deal")) return "target";
  if (e.startsWith("lead")) return "lead";
  if (e.startsWith("email")) return "email";
  return n.channel === "email" ? "email" : "bell";
}

/** Compact relative age ("3m", "2h", "5d", then a short date). */
function fmtAgo(iso: string, locale: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }).format(new Date(iso));
}

export function NotificationsBell() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  async function load() {
    try {
      const r = await apiFetch<{ items: Note[]; unread: number }>("/notifications");
      setItems(r.items);
      setUnread(r.unread);
      // Drop any selections whose notifications no longer exist.
      setChecked((prev) => new Set([...prev].filter((id) => r.items.some((n) => n.id === id))));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const timer = setInterval(load, 20_000);
    // Refresh immediately when the mail poller pulls new messages.
    const onSynced = () => load();
    window.addEventListener("aula:mail-synced", onSynced);
    return () => {
      clearInterval(timer);
      window.removeEventListener("aula:mail-synced", onSynced);
    };
  }, []);

  async function markRead() {
    if (unread === 0) return;
    setUnread(0);
    try {
      await apiFetch("/notifications", { method: "POST" });
    } catch {
      /* ignore */
    }
  }

  /** Delete one or many notifications (optimistic, reconciles on failure). */
  async function deleteIds(ids: string[]) {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const removedUnread = items.filter((n) => idSet.has(n.id) && !n.read).length;
    setItems((prev) => prev.filter((n) => !idSet.has(n.id)));
    setChecked((prev) => new Set([...prev].filter((id) => !idSet.has(id))));
    setUnread((u) => Math.max(0, u - removedUnread));
    try {
      await apiFetch("/notifications/delete", { method: "POST", body: { ids } });
      toast.success(t("notif.deletedToast", { n: String(ids.length) }));
    } catch {
      load(); // resync on failure
    }
  }

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const allChecked = items.length > 0 && items.every((n) => checked.has(n.id));
  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(items.map((n) => n.id)));
  }

  function openNote(n: Note, close: () => void) {
    if (!n.href) return;
    router.push(n.href);
    close();
  }

  return (
    <DropdownMenu
      align="end"
      panelClassName="w-80"
      trigger={({ toggle }) => (
        <button
          onClick={() => {
            toggle();
            markRead();
          }}
          aria-label={t("notif.title")}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <Icon name="bell" className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {unread}
            </span>
          )}
        </button>
      )}
    >
      {({ close }) => (
        <div className="flex max-h-[28rem] flex-col">
          {/* header */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-2.5 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-2">{t("notif.title")}</span>
            {items.length > 0 && (
              <button
                onClick={() => deleteIds(items.map((n) => n.id))}
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-danger"
              >
                {t("notif.clearAll")}
              </button>
            )}
          </div>

          {/* select / bulk-delete bar */}
          {items.length > 0 && (
            <div className="flex items-center gap-2 border-b border-border px-2.5 py-1 text-xs">
              <button
                onClick={toggleAll}
                aria-label={t("notif.selectAll")}
                className={cn(
                  "h-3.5 w-3.5 shrink-0 rounded border transition-colors",
                  allChecked ? "border-primary bg-primary" : "border-border-strong",
                )}
              />
              {checked.size > 0 ? (
                <>
                  <span className="font-medium text-primary">{t("notif.selected", { n: String(checked.size) })}</span>
                  <button
                    onClick={() => deleteIds([...checked])}
                    className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-danger transition-colors hover:bg-danger/10"
                  >
                    <Icon name="trash" className="h-3.5 w-3.5" />
                    {t("common.delete")}
                  </button>
                </>
              ) : (
                <span className="text-muted-2">{t("notif.selectAll")}</span>
              )}
            </div>
          )}

          {/* list */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted">{t("notif.empty")}</p>
            ) : (
              items.map((n) => {
                const isChecked = checked.has(n.id);
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "group flex items-start gap-2 px-2.5 py-1.5 transition-colors hover:bg-surface-2",
                      !n.read && "bg-primary/[0.04]",
                    )}
                  >
                    <button
                      onClick={() => toggleCheck(n.id)}
                      aria-label={t("notif.selectAll")}
                      className={cn(
                        "mt-1.5 h-3.5 w-3.5 shrink-0 rounded border transition-opacity",
                        isChecked
                          ? "border-primary bg-primary opacity-100"
                          : "border-border-strong opacity-0 group-hover:opacity-100",
                      )}
                    />
                    <button
                      onClick={() => openNote(n, close)}
                      disabled={!n.href}
                      className={cn("flex min-w-0 flex-1 items-start gap-2 text-left", n.href ? "cursor-pointer" : "cursor-default")}
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
                        <Icon name={noteIcon(n)} className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className={cn("truncate text-sm text-foreground", !n.read && "font-semibold")}>{n.subject}</span>
                          {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                          <span className="ml-auto shrink-0 text-[10px] text-muted-2">{fmtAgo(n.at, locale)}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">{n.body}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => deleteIds([n.id])}
                      aria-label={t("common.delete")}
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-2 opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                    >
                      <Icon name="close" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </DropdownMenu>
  );
}
