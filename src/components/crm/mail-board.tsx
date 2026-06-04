"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n/context";
import { RecipientPicker, type Recipient } from "./recipient-picker";

type FolderId = "inbox" | "sent" | "drafts" | "spam" | "trash";

export interface EmailRecord {
  id: string;
  folder: FolderId;
  sender: string;
  subject: string;
  /** Holds the short preview in the list; replaced by the full text once opened. */
  body: string;
  /** True once the full body has been lazily fetched (GET /entities/email/:id). */
  bodyFull?: boolean;
  unread: boolean;
  createdAt: string;
  version: number;
}

interface ComposeRecipient {
  name: string;
  email: string;
}

const FOLDERS: { id: FolderId; icon: string }[] = [
  { id: "inbox", icon: "inbox" },
  { id: "sent", icon: "send" },
  { id: "drafts", icon: "edit" },
  { id: "spam", icon: "shield" },
  { id: "trash", icon: "trash" },
];

interface Thread {
  key: string;
  msgs: EmailRecord[];
  latest: EmailRecord;
  count: number;
  unread: boolean;
}

const AVATAR_COLORS = ["#e41f07", "#2563eb", "#16a34a", "#9333ea", "#d97706", "#0891b2", "#db2777"];
const DRAFT_PLACEHOLDER = "(draft)";

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function threadKey(e: EmailRecord): string {
  const norm = e.subject.replace(/^((re|fwd|fw|aw|wg|vs)\s*:\s*)+/i, "").trim().toLowerCase();
  return norm ? `s:${norm}` : `id:${e.id}`;
}

/** Parse a stored "From / To" string back into recipients (only @ tokens). */
function parseRecipients(s: string): ComposeRecipient[] {
  return s
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter((x) => x.includes("@"))
    .map((email) => ({ name: email, email }));
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateGroupKey(iso: string): "today" | "yesterday" | "thisWeek" | "earlier" {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startToday.getDate() - 1);
  const startWeek = new Date(startToday);
  startWeek.setDate(startToday.getDate() - 6);
  if (d >= startToday) return "today";
  if (d >= startYesterday) return "yesterday";
  if (d >= startWeek) return "thisWeek";
  return "earlier";
}

function fmtListDate(iso: string, locale: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(d);
  if (d.getFullYear() === now.getFullYear())
    return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }).format(d);
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function fmtFullDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

/** Outlook-style mailbox backed by the `email` entity (persists to the backend/DB). */
export function MailBoard({ initial }: { initial: EmailRecord[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [emails, setEmails] = useState<EmailRecord[]>(initial);
  const [activeFolder, setActiveFolder] = useState<FolderId>("inbox");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  // Live deletion progress (null when idle). `move` = relocating to Trash, `purge` = hard delete from Trash.
  const [deleteProgress, setDeleteProgress] = useState<{ done: number; total: number; mode: "move" | "purge" } | null>(null);

  // Composer
  const [composing, setComposing] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<ComposeRecipient[]>([]);
  const [manualTo, setManualTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const [pending, startTransition] = useTransition();

  /** Re-pull the WHOLE mailbox (preview only) from the DB into local state after
   *  a sync, paging through it. Full bodies are fetched lazily on open. */
  async function reload() {
    try {
      const all: EmailRecord[] = [];
      for (let page = 1; page <= 500; page++) {
        const res = await apiFetch<{ items: Record<string, unknown>[] }>(`/email/list?page=${page}`);
        for (const r of res.items) {
          all.push({
            id: String(r.id),
            folder: (r.folder as FolderId) ?? "inbox",
            sender: String(r.sender ?? ""),
            subject: String(r.subject ?? ""),
            body: String(r.preview ?? ""), // preview only; full text fetched lazily
            bodyFull: false,
            unread: Boolean(r.unread),
            createdAt: String(r.createdAt ?? ""),
            version: Number(r.version ?? 0),
          });
        }
        if (res.items.length < 200) break; // last page
      }
      setEmails(all);
    } catch {
      /* ignore */
    }
  }

  /** Lazily fetch + cache a message's full body (no-op once loaded). Returns it. */
  async function loadBody(id: string): Promise<string> {
    const rec = emails.find((e) => e.id === id);
    if (rec?.bodyFull) return rec.body;
    try {
      const full = await apiFetch<{ body?: string }>(`/entities/email/${id}`);
      const body = String(full.body ?? "");
      setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, body, bodyFull: true } : e)));
      return body;
    } catch {
      return rec?.body ?? "";
    }
  }

  // When the global poller pulls new mail, refresh the open mailbox too.
  useEffect(() => {
    const onSynced = () => reload();
    window.addEventListener("aula:mail-synced", onSynced);
    return () => window.removeEventListener("aula:mail-synced", onSynced);
  }, []);

  // Notification deep link: /email?open=<id> opens that exact message. We retry as
  // `emails` fills in (the target may not be loaded yet), then strip the param.
  const openParam = searchParams.get("open");
  const handledOpenRef = useRef<string | null>(null);
  const triedReloadRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openParam) {
      handledOpenRef.current = null;
      triedReloadRef.current = null;
      return;
    }
    if (handledOpenRef.current === openParam) return;
    if (openMessageById(openParam)) {
      handledOpenRef.current = openParam;
      router.replace("/email", { scroll: false }); // clean the URL so refresh/back won't re-open
    } else if (triedReloadRef.current !== openParam) {
      // Target not in local state yet — pull the mailbox once; the effect re-runs when it lands.
      triedReloadRef.current = openParam;
      void reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openParam, emails]);

  const stats = useMemo(() => {
    const total: Record<string, number> = {};
    const unread: Record<string, number> = {};
    for (const e of emails) {
      total[e.folder] = (total[e.folder] ?? 0) + 1;
      if (e.unread) unread[e.folder] = (unread[e.folder] ?? 0) + 1;
    }
    return { total, unread };
  }, [emails]);

  const threads = useMemo<Thread[]>(() => {
    let list = emails.filter((e) => e.folder === activeFolder);
    if (filter === "unread") list = list.filter((e) => e.unread);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((e) => `${e.sender} ${e.subject} ${e.body}`.toLowerCase().includes(q));

    const map = new Map<string, EmailRecord[]>();
    for (const e of list) {
      const k = threadKey(e);
      const bucket = map.get(k);
      if (bucket) bucket.push(e);
      else map.set(k, [e]);
    }
    const arr: Thread[] = [];
    for (const [key, msgs] of map) {
      msgs.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      const latest = msgs[msgs.length - 1];
      arr.push({ key, msgs, latest, count: msgs.length, unread: msgs.some((m) => m.unread) });
    }
    arr.sort((a, b) => (a.latest.createdAt < b.latest.createdAt ? 1 : -1));
    return arr;
  }, [emails, activeFolder, filter, search]);

  const selected = threads.find((th) => th.key === selectedKey) ?? null;
  const allChecked = threads.length > 0 && threads.every((th) => checked.has(th.key));

  // Flatten the conversation list (date-group headers + thread rows) into a
  // single array, then virtualize it so only on-screen rows hit the DOM —
  // keeps the mailbox snappy with thousands of messages.
  const listRows = useMemo<({ type: "header"; key: string; group: string } | { type: "thread"; key: string; thread: Thread })[]>(() => {
    const out: ({ type: "header"; key: string; group: string } | { type: "thread"; key: string; thread: Thread })[] = [];
    let lastGroup = "";
    for (const th of threads) {
      const gk = dateGroupKey(th.latest.createdAt);
      if (gk !== lastGroup) {
        lastGroup = gk;
        out.push({ type: "header", key: `h:${gk}`, group: gk });
      }
      out.push({ type: "thread", key: th.key, thread: th });
    }
    return out;
  }, [threads]);

  const listScrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: listRows.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: (i) => (listRows[i]?.type === "header" ? 26 : 76),
    overscan: 10,
    getItemKey: (i) => listRows[i]?.key ?? i,
  });

  function fail(e: unknown) {
    toast.error(e instanceof ApiRequestError ? e.message : "Something went wrong");
  }

  function resetCompose() {
    setComposing(false);
    setDraftId(null);
    setRecipients([]);
    setManualTo("");
    setSubject("");
    setBody("");
  }

  function selectFolder(f: FolderId) {
    setActiveFolder(f);
    setSelectedKey(null);
    setExpanded(new Set());
    setChecked(new Set());
    resetCompose();
  }

  function collectEmails(): string[] {
    const list = recipients.map((r) => r.email);
    const m = manualTo.trim();
    if (m.includes("@")) list.push(m);
    return [...new Set(list.map((e) => e.trim()).filter(Boolean))];
  }

  function addRecipients(incoming: { name: string; email: string }[]) {
    setRecipients((prev) => {
      const seen = new Set(prev.map((r) => r.email.toLowerCase()));
      const merged = [...prev];
      for (const r of incoming) {
        if (!seen.has(r.email.toLowerCase())) {
          merged.push({ name: r.name, email: r.email });
          seen.add(r.email.toLowerCase());
        }
      }
      return merged;
    });
  }

  function addManual() {
    const m = manualTo.trim();
    if (!m.includes("@")) return;
    addRecipients([{ name: m, email: m }]);
    setManualTo("");
  }

  function removeRecipient(email: string) {
    setRecipients((prev) => prev.filter((r) => r.email !== email));
  }

  // ── thread open / read ──────────────────────────────
  /** Mark a thread's unread messages read (PATCH); the response carries the full body, so cache it. */
  function markMessagesRead(msgs: EmailRecord[]) {
    const toMark = msgs.filter((m) => m.unread);
    if (toMark.length === 0) return;
    startTransition(async () => {
      try {
        const updated = await Promise.all(
          toMark.map((m) =>
            apiFetch<EmailRecord>(`/entities/email/${m.id}`, {
              method: "PATCH",
              body: { unread: false },
              headers: { "if-match": String(m.version) },
            }),
          ),
        );
        const byId = new Map(updated.map((u) => [u.id, { ...u, bodyFull: true }]));
        setEmails((prev) => prev.map((x) => byId.get(x.id) ?? x));
      } catch (e) {
        fail(e);
      }
    });
  }

  function openThread(th: Thread) {
    if (activeFolder === "drafts") {
      openDraft(th.latest);
      return;
    }
    setSelectedKey(th.key);
    setComposing(false);
    setExpanded(new Set());
    // The latest message is expanded by default — make sure its full body is loaded.
    // (Unread messages get their body for free from the mark-read response below.)
    if (!th.latest.unread) void loadBody(th.latest.id);
    markMessagesRead(th.msgs);
  }

  /** Open a specific message by id (used by the notification deep link). Switches to
   *  its folder, selects its thread, loads the body and marks the thread read.
   *  Returns false when the message isn't in local state yet (so the caller can wait). */
  function openMessageById(id: string): boolean {
    const target = emails.find((e) => e.id === id);
    if (!target) return false;
    const key = threadKey(target);
    setComposing(false);
    setActiveFolder(target.folder);
    setFilter("all"); // make sure the thread is visible regardless of the unread filter
    setExpanded(new Set());
    setSelectedKey(key);
    void loadBody(target.id);
    markMessagesRead(emails.filter((e) => e.folder === target.folder && threadKey(e) === key));
    return true;
  }

  function markThreadUnread(th: Thread) {
    const m = th.latest;
    startTransition(async () => {
      try {
        const updated = await apiFetch<EmailRecord>(`/entities/email/${m.id}`, {
          method: "PATCH",
          body: { unread: true },
          headers: { "if-match": String(m.version) },
        });
        setEmails((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
      } catch (e) {
        fail(e);
      }
    });
  }

  // ── delete (single thread or bulk) ──────────────────
  // From any folder except Trash, messages are *moved* to Trash (folder → "trash");
  // from Trash itself they are *purged* (hard DELETE). Either way state is updated
  // per-message as each request resolves — rows leave the current view live and the
  // ratio banner ticks up — and a small pool keeps it fast for large selections.
  const deleting = deleteProgress !== null;

  async function runDelete(msgs: EmailRecord[]): Promise<{ ok: number; failed: number; mode: "move" | "purge" }> {
    const purge = activeFolder === "trash";
    const mode: "move" | "purge" = purge ? "purge" : "move";
    const total = msgs.length;
    setDeleteProgress({ done: 0, total, mode });
    let done = 0;
    let failed = 0;
    const queue = [...msgs];

    async function worker() {
      while (queue.length) {
        const m = queue.shift()!;
        try {
          if (purge) {
            await apiFetch(`/entities/email/${m.id}`, { method: "DELETE", headers: { "if-match": String(m.version) } });
            setEmails((prev) => prev.filter((x) => x.id !== m.id));
          } else {
            const updated = await apiFetch<EmailRecord>(`/entities/email/${m.id}`, {
              method: "PATCH",
              body: { folder: "trash" },
              headers: { "if-match": String(m.version) },
            });
            setEmails((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
          }
        } catch {
          failed++;
        } finally {
          done++;
          setDeleteProgress({ done, total, mode });
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(8, total) }, worker));
    setDeleteProgress(null);
    return { ok: total - failed, failed, mode };
  }

  function reportDelete(r: { ok: number; failed: number; mode: "move" | "purge" }) {
    if (r.ok > 0)
      toast.success(t(r.mode === "purge" ? "email.delete.purgedToast" : "email.delete.movedToast", { n: String(r.ok) }));
    if (r.failed > 0) toast.error(t("email.delete.failedToast", { n: String(r.failed) }));
  }

  function deleteThread(th: Thread) {
    if (deleting) return;
    if (selectedKey === th.key) setSelectedKey(null);
    setChecked((prev) => {
      const n = new Set(prev);
      n.delete(th.key);
      return n;
    });
    runDelete(th.msgs).then(reportDelete).catch(fail);
  }

  function bulkDelete() {
    if (deleting) return;
    const msgs = threads.filter((th) => checked.has(th.key)).flatMap((th) => th.msgs);
    if (msgs.length === 0) return;
    setChecked(new Set());
    setSelectedKey(null);
    runDelete(msgs).then(reportDelete).catch(fail);
  }

  function toggleCheck(key: string) {
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(threads.map((th) => th.key)));
  }

  // ── compose / drafts ────────────────────────────────
  function startCompose() {
    resetCompose();
    setComposing(true);
    setSelectedKey(null);
  }

  async function openDraft(m: EmailRecord) {
    setDraftId(m.id);
    setRecipients(parseRecipients(m.sender));
    setManualTo("");
    setSubject(m.subject);
    setComposing(true);
    setSelectedKey(null);
    setBody(await loadBody(m.id)); // drafts need the full body in the editor
  }

  function reply(th: Thread) {
    resetCompose();
    setRecipients(parseRecipients(th.latest.sender));
    setSubject(th.latest.subject.match(/^re\s*:/i) ? th.latest.subject : `Re: ${th.latest.subject}`);
    setComposing(true);
    setSelectedKey(null);
  }

  async function forward(th: Thread) {
    resetCompose();
    setSubject(th.latest.subject.match(/^fwd?\s*:/i) ? th.latest.subject : `Fwd: ${th.latest.subject}`);
    setComposing(true);
    setSelectedKey(null);
    const fullBody = await loadBody(th.latest.id); // need the full text to quote
    setBody(`\n\n---------- ${t("email.forward")} ----------\n${th.latest.sender}\n\n${fullBody}`);
  }

  function send() {
    const list = collectEmails();
    if (list.length === 0) return;
    const draft = draftId ? emails.find((x) => x.id === draftId) ?? null : null;
    startTransition(async () => {
      try {
        const res = await apiFetch<{ records: EmailRecord[]; sent: boolean; count: number }>("/email/send", {
          method: "POST",
          body: { to: list, subject: subject.trim(), body },
        });
        if (draft) {
          await apiFetch(`/entities/email/${draft.id}`, {
            method: "DELETE",
            headers: { "if-match": String(draft.version) },
          }).catch(() => undefined);
        }
        setEmails((prev) => {
          const next = [...res.records, ...prev];
          return draft ? next.filter((x) => x.id !== draft.id) : next;
        });
        resetCompose();
        setActiveFolder("sent");
        toast.success(
          list.length === 1 ? t("email.sentToast", { to: list[0] }) : t("email.bulkSentToast", { n: String(list.length) }),
        );
      } catch (e) {
        fail(e);
      }
    });
  }

  function saveDraft() {
    const senderJoined = collectEmails().join(", ") || DRAFT_PLACEHOLDER;
    const draft = draftId ? emails.find((x) => x.id === draftId) ?? null : null;
    startTransition(async () => {
      try {
        if (draft) {
          const updated = await apiFetch<EmailRecord>(`/entities/email/${draft.id}`, {
            method: "PATCH",
            body: { sender: senderJoined, subject: subject.trim(), body },
            headers: { "if-match": String(draft.version) },
          });
          setEmails((prev) => prev.map((x) => (x.id === draft.id ? updated : x)));
        } else {
          const created = await apiFetch<EmailRecord>(`/entities/email`, {
            method: "POST",
            body: { folder: "drafts", sender: senderJoined, subject: subject.trim(), body, unread: false },
          });
          setEmails((prev) => [created, ...prev]);
        }
        resetCompose();
        setActiveFolder("drafts");
        toast.success(t("email.compose.draftSaved"));
      } catch (e) {
        fail(e);
      }
    });
  }

  function sync() {
    startTransition(async () => {
      try {
        const res = await apiFetch<{ configured: boolean; synced: number }>("/email/sync", { method: "POST" });
        if (!res.configured) {
          toast.message(t("email.syncNotConfigured"), { description: t("email.syncNotConfiguredDesc") });
          return;
        }
        await reload();
        toast.success(t("email.syncedToast", { n: String(res.synced) }));
        if (res.synced > 0) window.dispatchEvent(new CustomEvent("aula:mail-synced", { detail: { synced: res.synced } }));
      } catch (e) {
        fail(e);
      }
    });
  }

  const folderName = (f: FolderId) => t(`email.folder.${f}`);

  function folderBadge(f: FolderId) {
    const accent = f === "inbox" || f === "spam";
    const n = accent ? stats.unread[f] ?? 0 : stats.total[f] ?? 0;
    if (n <= 0) return null;
    return (
      <span className={cn("ml-auto text-xs tabular-nums", accent ? "font-semibold text-primary" : "text-muted-2")}>
        {n}
      </span>
    );
  }

  function renderThreadRow(th: Thread) {
    const display = th.latest.sender || "?";
    const color = avatarColor(display);
    const isChecked = checked.has(th.key);
    return (
      <div
        className={cn(
          "group flex items-start gap-2 border-l-2 pl-2 pr-3 transition-colors",
          selectedKey === th.key
            ? "border-l-primary bg-primary/5"
            : th.unread
              ? "border-l-primary/60 hover:bg-surface-2"
              : "border-l-transparent hover:bg-surface-2",
        )}
      >
        <button
          onClick={() => toggleCheck(th.key)}
          aria-label={t("email.selectAll")}
          className={cn(
            "mt-3.5 h-4 w-4 shrink-0 rounded border transition-opacity",
            isChecked
              ? "border-primary bg-primary opacity-100"
              : "border-border-strong opacity-0 group-hover:opacity-100",
          )}
        />
        <button onClick={() => openThread(th)} className="flex min-w-0 flex-1 items-start gap-3 py-2.5 text-left">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            style={{ backgroundColor: `${color}1a`, color }}
          >
            {initials(display)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn("truncate text-sm text-foreground", th.unread && "font-semibold")}>{display}</span>
              {th.count > 1 && (
                <span className="shrink-0 rounded-full bg-surface-2 px-1.5 text-[11px] font-medium text-muted">{th.count}</span>
              )}
              <span className="ml-auto shrink-0 text-[11px] text-muted-2">{fmtListDate(th.latest.createdAt, locale)}</span>
            </div>
            <p className={cn("truncate text-sm text-foreground", th.unread && "font-semibold")}>
              {th.latest.subject || t("email.noSubject")}
            </p>
            <p className="truncate text-xs text-muted">{th.latest.body}</p>
          </div>
          {th.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t("email.title")}</h1>
          <p className="text-xs text-muted">{t("email.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={sync} disabled={pending || deleting}>
          <Icon name="recurring" className="h-3.5 w-3.5" />
          {t("email.sync")}
        </Button>
      </div>

      {deleteProgress && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
          <Icon name="trash" className="h-4 w-4 shrink-0 text-danger" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-foreground">
                {t(deleteProgress.mode === "purge" ? "email.delete.purging" : "email.delete.moving")}
              </span>
              <span className="shrink-0 tabular-nums text-muted">
                {t("email.delete.progress", {
                  done: String(deleteProgress.done),
                  total: String(deleteProgress.total),
                  pct: String(Math.round((deleteProgress.done / Math.max(1, deleteProgress.total)) * 100)),
                })}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-danger transition-[width] duration-200 ease-out"
                style={{ width: `${Math.round((deleteProgress.done / Math.max(1, deleteProgress.total)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid h-[calc(100vh-12rem)] min-h-[32rem] gap-3 overflow-hidden lg:grid-cols-[230px_minmax(300px,360px)_1fr]">
        {/* ── Folder rail ───────────────────────────── */}
        <aside className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3">
          <Button className="w-full" variant="primary" size="sm" onClick={startCompose} disabled={pending}>
            <Icon name="plus" className="h-3.5 w-3.5" />
            {t("email.newMail")}
          </Button>
          <nav className="space-y-0.5">
            {FOLDERS.map((f) => (
              <button
                key={f.id}
                onClick={() => selectFolder(f.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  activeFolder === f.id
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <Icon name={f.icon} className="h-4 w-4 shrink-0" />
                <span className="truncate">{folderName(f.id)}</span>
                {folderBadge(f.id)}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Conversation list ─────────────────────── */}
        <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
          <div className="border-b border-border p-2.5">
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("email.search")} className="h-8 pl-8" />
            </div>
            <div className="mt-2 flex gap-1">
              {(["all", "unread"] as const).map((fk) => (
                <button
                  key={fk}
                  onClick={() => setFilter(fk)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    filter === fk ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-2",
                  )}
                >
                  {t(fk === "all" ? "email.filterAll" : "email.filterUnread")}
                </button>
              ))}
            </div>
          </div>

          {/* select-all + bulk actions */}
          {threads.length > 0 && (
            <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs">
              <button
                onClick={toggleAll}
                aria-label={t("email.selectAll")}
                className={cn(
                  "h-4 w-4 shrink-0 rounded border",
                  allChecked ? "border-primary bg-primary" : "border-border-strong",
                )}
              />
              {checked.size > 0 ? (
                <>
                  <span className="font-medium text-primary">{t("email.selectedCount", { n: String(checked.size) })}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={bulkDelete}
                      disabled={pending || deleting}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                      {t("common.delete")}
                    </button>
                    <button onClick={() => setChecked(new Set())} className="rounded-md px-2 py-1 text-muted hover:bg-surface-2">
                      {t("email.clearSelection")}
                    </button>
                  </div>
                </>
              ) : (
                <span className="text-muted-2">{t("email.selectAll")}</span>
              )}
            </div>
          )}

          <div ref={listScrollRef} className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <p className="p-4 text-sm text-muted">{t("email.empty")}</p>
            ) : (
              <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative", width: "100%" }}>
                {rowVirtualizer.getVirtualItems().map((vi) => {
                  const row = listRows[vi.index];
                  if (!row) return null;
                  return (
                    <div
                      key={vi.key}
                      data-index={vi.index}
                      ref={rowVirtualizer.measureElement}
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)` }}
                    >
                      {row.type === "header" ? (
                        <div className="bg-surface-2/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-2">
                          {t(`email.date.${row.group}`)}
                        </div>
                      ) : (
                        renderThreadRow(row.thread)
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── Reading pane / composer ───────────────── */}
        <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
          {composing ? (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold tracking-tight">{t("email.compose.title")}</h2>
                <button
                  onClick={resetCompose}
                  aria-label={t("email.compose.discard")}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
                {/* Recipients */}
                <div className="rounded-lg border border-border px-2 py-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {recipients.map((r) => (
                      <span key={r.email} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-2 pr-1 text-xs">
                        <span className="max-w-[12rem] truncate">{r.name}</span>
                        <button
                          onClick={() => removeRecipient(r.email)}
                          aria-label={t("common.delete")}
                          className="flex h-4 w-4 items-center justify-center rounded-full text-muted hover:bg-border-strong hover:text-foreground"
                        >
                          <Icon name="close" className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      value={manualTo}
                      onChange={(e) => setManualTo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addManual();
                        }
                      }}
                      onBlur={addManual}
                      placeholder={recipients.length === 0 ? t("email.manualPlaceholder") : ""}
                      className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm text-foreground outline-none placeholder:text-muted-2"
                    />
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      <Icon name="users" className="h-3.5 w-3.5" />
                      {t("email.compose.addRecipients")}
                    </button>
                  </div>
                </div>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("email.compose.subject")} />
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t("email.compose.body")}
                  className="min-h-48 flex-1"
                />
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border p-3">
                <Button variant="ghost" size="sm" onClick={saveDraft} disabled={pending}>
                  <Icon name="edit" className="h-3.5 w-3.5" />
                  {t("email.compose.saveDraft")}
                </Button>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={resetCompose} disabled={pending}>
                    {t("email.compose.discard")}
                  </Button>
                  <Button variant="primary" size="sm" onClick={send} loading={pending} disabled={collectEmails().length === 0}>
                    <Icon name="send" className="h-3.5 w-3.5" />
                    {t("email.compose.send")}
                  </Button>
                </div>
              </div>
            </>
          ) : selected ? (
            <>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold">{selected.latest.subject || t("email.noSubject")}</h2>
                  {selected.count > 1 && (
                    <p className="text-xs text-muted-2">{t("email.messages", { n: String(selected.count) })}</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => reply(selected)} disabled={pending}>
                  <Icon name="reply" className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("email.reply")}</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => forward(selected)} disabled={pending}>
                  <Icon name="forward" className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("email.forward")}</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => markThreadUnread(selected)} disabled={pending} aria-label={t("email.markUnread")}>
                  <Icon name="mailOpen" className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteThread(selected)} disabled={pending || deleting} aria-label={t("common.delete")}>
                  <Icon name="trash" className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {selected.msgs
                  .slice()
                  .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                  .map((m) => {
                    const isLatest = m.id === selected.latest.id;
                    const isOpen = isLatest || expanded.has(m.id);
                    const color = avatarColor(m.sender || "?");
                    return (
                      <div key={m.id} className="overflow-hidden rounded-lg border border-border">
                        <button
                          onClick={() => {
                            const willOpen = !expanded.has(m.id);
                            setExpanded((prev) => {
                              const next = new Set(prev);
                              if (next.has(m.id)) next.delete(m.id);
                              else next.add(m.id);
                              return next;
                            });
                            if (willOpen) void loadBody(m.id); // fetch full text on expand
                          }}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                        >
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                            style={{ backgroundColor: `${color}1a`, color }}
                          >
                            {initials(m.sender || "?")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-foreground">{m.sender}</span>
                              <span className="ml-auto shrink-0 text-[11px] text-muted-2">{fmtFullDate(m.createdAt, locale)}</span>
                            </div>
                            {!isOpen && <p className="truncate text-xs text-muted">{m.body}</p>}
                          </div>
                          <Icon name={isOpen ? "chevronDown" : "chevronRight"} className="h-4 w-4 shrink-0 text-muted-2" />
                        </button>
                        {isOpen && (
                          <div className="whitespace-pre-line border-t border-border px-3 py-3 text-sm leading-relaxed text-foreground">
                            {m.body || "—"}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              <div className="border-t border-border p-3">
                <Button variant="primary" size="sm" onClick={() => reply(selected)} disabled={pending}>
                  <Icon name="reply" className="h-3.5 w-3.5" />
                  {t("email.reply")}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <Icon name="email" className="h-10 w-10 text-muted-2" />
              <p className="text-sm text-muted">{t("email.select")}</p>
            </div>
          )}
        </section>
      </div>

      <RecipientPicker
        open={pickerOpen}
        already={recipients.map((r) => r.email)}
        onClose={() => setPickerOpen(false)}
        onAdd={(rs: Recipient[]) => addRecipients(rs)}
      />
    </div>
  );
}
