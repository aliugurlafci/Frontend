"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { DropdownMenu, MenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n/context";
import { RecipientPicker, type Recipient } from "./recipient-picker";

type FolderId = "inbox" | "sent" | "drafts" | "spam" | "trash";

export interface EmailRecord {
  id: string;
  folder: FolderId;
  /** Custom-folder membership (→ emailFolder). Empty = lives in its base `folder`. */
  folderId?: string | null;
  starred?: boolean;
  /** RFC Message-ID (synced inbox mail only) — lets bulk delete target the IMAP server. */
  messageId?: string;
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

/** A user-created mail folder (emailFolder entity). */
interface MailFolder {
  id: string;
  name: string;
  color?: string;
  version: number;
}

interface ComposeRecipient {
  name: string;
  email: string;
}

/** Where a "Move to…" action sends messages. */
type MoveTarget =
  | { kind: "system"; id: FolderId; key: string; label: string; icon: string }
  | { kind: "custom"; id: string; key: string; label: string; color?: string };

/** System views shown in the rail (folders + the cross-folder Starred view). */
const SYSTEM_VIEWS: { view: string; icon: string }[] = [
  { view: "inbox", icon: "inbox" },
  { view: "starred", icon: "star" },
  { view: "sent", icon: "send" },
  { view: "drafts", icon: "edit" },
  { view: "spam", icon: "shield" },
  { view: "trash", icon: "trash" },
];

/** System folders a message can be *moved* into from the Move menu. */
const MOVE_SYSTEM: { id: FolderId; icon: string }[] = [
  { id: "inbox", icon: "inbox" },
  { id: "spam", icon: "shield" },
];

const FOLDER_COLORS = ["#2563eb", "#16a34a", "#9333ea", "#d97706", "#e41f07", "#0891b2", "#db2777", "#64748b"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Delete / move / restore are sent to the backend in batches of this size, so a
 *  selection of any size becomes a handful of bulk requests instead of one-per-mail. */
const BULK_CHUNK = 250;

const AVATAR_COLORS = ["#e41f07", "#2563eb", "#16a34a", "#9333ea", "#d97706", "#0891b2", "#db2777"];
const DRAFT_PLACEHOLDER = "(draft)";

interface Thread {
  key: string;
  msgs: EmailRecord[];
  latest: EmailRecord;
  count: number;
  unread: boolean;
  starred: boolean;
}

function byName(a: MailFolder, b: MailFolder): number {
  return a.name.localeCompare(b.name);
}

/** True when message `e` belongs in the given rail view. */
function matchesView(e: EmailRecord, view: string): boolean {
  if (view === "starred") return !!e.starred && e.folder !== "trash";
  if (view.startsWith("cust:")) return e.folderId === view.slice(5);
  return e.folder === view && !e.folderId;
}

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
  const [folders, setFolders] = useState<MailFolder[]>([]);
  // A view is a system folder id, "starred", or `cust:<folderId>`.
  const [activeView, setActiveView] = useState<string>("inbox");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  // Live deletion progress (null when idle). `move` = relocating to Trash, `purge` = hard delete from Trash.
  const [deleteProgress, setDeleteProgress] = useState<{ done: number; total: number; mode: "move" | "purge" } | null>(null);
  // Set to true to stop an in-flight bulk delete (already-issued requests finish; no new ones start).
  const cancelDeleteRef = useRef(false);

  // Custom-folder management
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [editingFolder, setEditingFolder] = useState<{ id: string; name: string } | null>(null);

  // Composer
  const [composing, setComposing] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<ComposeRecipient[]>([]);
  const [manualTo, setManualTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

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
            folderId: r.folderId ? String(r.folderId) : null,
            starred: Boolean(r.starred),
            messageId: r.messageId ? String(r.messageId) : "",
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

  /** Load the user's custom mail folders. */
  async function loadFolders() {
    try {
      const res = await apiFetch<{ items: Record<string, unknown>[] }>(`/entities/emailFolder?pageSize=200`);
      setFolders(
        res.items
          .map((r) => ({
            id: String(r.id),
            name: String(r.name ?? ""),
            color: r.color ? String(r.color) : undefined,
            version: Number(r.version ?? 0),
          }))
          .sort(byName),
      );
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
      const text = String(full.body ?? "");
      setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, body: text, bodyFull: true } : e)));
      return text;
    } catch {
      return rec?.body ?? "";
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFolders();
  }, []);

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
    const sysTotal: Record<string, number> = {};
    const sysUnread: Record<string, number> = {};
    const custTotal: Record<string, number> = {};
    let starredCount = 0;
    for (const e of emails) {
      if (e.folderId) {
        custTotal[e.folderId] = (custTotal[e.folderId] ?? 0) + 1;
      } else {
        sysTotal[e.folder] = (sysTotal[e.folder] ?? 0) + 1;
        if (e.unread) sysUnread[e.folder] = (sysUnread[e.folder] ?? 0) + 1;
      }
      if (e.starred && e.folder !== "trash") starredCount++;
    }
    return { sysTotal, sysUnread, custTotal, starredCount };
  }, [emails]);

  const threads = useMemo<Thread[]>(() => {
    let list = emails.filter((e) => matchesView(e, activeView));
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
      arr.push({ key, msgs, latest, count: msgs.length, unread: msgs.some((m) => m.unread), starred: msgs.some((m) => m.starred) });
    }
    arr.sort((a, b) => (a.latest.createdAt < b.latest.createdAt ? 1 : -1));
    return arr;
  }, [emails, activeView, filter, search]);

  const selected = threads.find((th) => th.key === selectedKey) ?? null;
  const allChecked = threads.length > 0 && threads.every((th) => checked.has(th.key));

  // Targets offered by the "Move to…" menu (excludes the current view).
  const moveTargets = useMemo<MoveTarget[]>(() => {
    const out: MoveTarget[] = [];
    for (const s of MOVE_SYSTEM) {
      if (activeView !== s.id) out.push({ kind: "system", id: s.id, key: `sys:${s.id}`, label: t(`email.folder.${s.id}`), icon: s.icon });
    }
    for (const f of folders) {
      if (activeView !== `cust:${f.id}`) out.push({ kind: "custom", id: f.id, key: `cust:${f.id}`, label: f.name, color: f.color });
    }
    return out;
  }, [folders, activeView, t]);

  // Flatten the conversation list (date-group headers + thread rows) into a
  // single array, then virtualize it so only on-screen rows hit the DOM.
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

  function selectView(view: string) {
    setActiveView(view);
    setSelectedKey(null);
    setExpanded(new Set());
    setChecked(new Set());
    resetCompose();
  }

  // ── compose recipients (incl. free-text addresses not in the system) ──
  function collectEmails(): string[] {
    const list = recipients.map((r) => r.email);
    for (const p of manualTo.split(/[\s,;]+/)) {
      const e = p.trim();
      if (EMAIL_RE.test(e)) list.push(e);
    }
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

  /** Add one or many free-text addresses (paste a comma/space-separated list). */
  function addManual() {
    const raw = manualTo.trim();
    if (!raw) return;
    const parts = raw.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
    const valid: { name: string; email: string }[] = [];
    const invalid: string[] = [];
    for (const p of parts) {
      if (EMAIL_RE.test(p)) valid.push({ name: p, email: p });
      else invalid.push(p);
    }
    if (valid.length) addRecipients(valid);
    if (invalid.length) {
      toast.error(t("email.compose.invalidEmail", { value: invalid.join(", ") }));
      setManualTo(invalid.join(", "));
    } else {
      setManualTo("");
    }
  }

  function removeRecipient(email: string) {
    setRecipients((prev) => prev.filter((r) => r.email !== email));
  }

  // ── thread open / read ──────────────────────────────
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
    if (th.latest.folder === "drafts") {
      openDraft(th.latest);
      return;
    }
    setSelectedKey(th.key);
    setComposing(false);
    setExpanded(new Set());
    if (!th.latest.unread) void loadBody(th.latest.id);
    markMessagesRead(th.msgs);
  }

  /** Open a specific message by id (notification deep link). Returns false if not loaded yet. */
  function openMessageById(id: string): boolean {
    const target = emails.find((e) => e.id === id);
    if (!target) return false;
    const view = target.folderId ? `cust:${target.folderId}` : target.folder;
    const key = threadKey(target);
    setComposing(false);
    setActiveView(view);
    setFilter("all");
    setExpanded(new Set());
    setSelectedKey(key);
    void loadBody(target.id);
    markMessagesRead(emails.filter((e) => matchesView(e, view) && threadKey(e) === key));
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

  // ── star / flag ─────────────────────────────────────
  function toggleStar(th: Thread) {
    const anyStar = th.msgs.some((m) => m.starred);
    const targets = anyStar ? th.msgs.filter((m) => m.starred) : [th.latest];
    const value = !anyStar;
    startTransition(async () => {
      await Promise.all(
        targets.map(async (m) => {
          try {
            const updated = await apiFetch<EmailRecord>(`/entities/email/${m.id}`, {
              method: "PATCH",
              body: { starred: value },
              headers: { "if-match": String(m.version) },
            });
            setEmails((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
          } catch {
            /* ignore */
          }
        }),
      );
    });
  }

  /** Optimistically apply a folder/folderId patch to the given ids (version +1, matching the bulk UPDATE). */
  function applyPatchLocal(ids: string[], patch: { folder?: FolderId; folderId?: string | null }) {
    const idSet = new Set(ids);
    setEmails((prev) => prev.map((x) => (idSet.has(x.id) ? { ...x, ...patch, version: x.version + 1 } : x)));
  }

  // ── move to folder (bulk, chunked — one UPDATE per chunk) ──
  function moveMessages(msgs: EmailRecord[], target: MoveTarget) {
    if (msgs.length === 0) return;
    setSelectedKey(null);
    setChecked(new Set());
    const patch: { folder?: FolderId; folderId: string | null } =
      target.kind === "custom" ? { folderId: target.id } : { folder: target.id, folderId: null };
    startTransition(async () => {
      let moved = 0;
      let failure: unknown = null;
      for (let i = 0; i < msgs.length; i += BULK_CHUNK) {
        const ids = msgs.slice(i, i + BULK_CHUNK).map((m) => m.id);
        try {
          const res = await apiFetch<{ updated: number }>("/email/move", { method: "POST", body: { ids, ...patch } });
          applyPatchLocal(ids, patch);
          moved += res.updated;
        } catch (e) {
          failure = e;
        }
      }
      if (moved > 0) toast.success(t("email.move.toast", { n: String(moved) }));
      else if (failure) fail(failure);
      else toast.error(t("email.move.failed"));
    });
  }

  function renderMoveItems(msgs: EmailRecord[], close: () => void) {
    if (moveTargets.length === 0) return <div className="px-2.5 py-1.5 text-xs text-muted-2">{t("email.folders.empty")}</div>;
    return (
      <>
        {moveTargets.map((tg) => (
          <MenuItem key={tg.key} onClick={() => { moveMessages(msgs, tg); close(); }}>
            {tg.kind === "custom" ? (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tg.color || "#64748b" }} />
            ) : (
              <Icon name={tg.icon} className="h-3.5 w-3.5" />
            )}
            {tg.label}
          </MenuItem>
        ))}
      </>
    );
  }

  // ── delete (single thread or bulk) ──────────────────
  // From any view except Trash, messages are *moved* to Trash; from Trash they
  // are *purged*. A running delete can be stopped, and moves can be undone.
  const deleting = deleteProgress !== null;

  // Deletes run as bulk requests in BULK_CHUNK batches: from any view except Trash
  // each batch moves to Trash (DB + the IMAP server), from Trash it purges. A batch
  // boundary is also where a "Stop" takes effect.
  async function runDelete(msgs: EmailRecord[]) {
    const purge = activeView === "trash";
    const mode: "move" | "purge" = purge ? "purge" : "move";
    cancelDeleteRef.current = false;
    const total = msgs.length;
    setDeleteProgress({ done: 0, total, mode });
    let done = 0;
    let ok = 0;
    let failed = 0;
    let cancelled = false;
    let failure: unknown = null;
    // Each trashed message's origin (+ its bumped version + message-id) so an undo can put it back.
    const restorable: { id: string; folder: FolderId; folderId: string | null; version: number; messageId?: string }[] = [];

    for (let i = 0; i < msgs.length; i += BULK_CHUNK) {
      if (cancelDeleteRef.current) {
        cancelled = true;
        break;
      }
      const chunk = msgs.slice(i, i + BULK_CHUNK);
      const ids = chunk.map((m) => m.id);
      const messageIds = chunk.map((m) => m.messageId).filter((x): x is string => !!x);
      try {
        if (purge) {
          const res = await apiFetch<{ deleted: number }>("/email/purge", { method: "POST", body: { ids, messageIds } });
          const gone = new Set(ids);
          setEmails((prev) => prev.filter((x) => !gone.has(x.id)));
          ok += res.deleted;
          failed += ids.length - res.deleted;
        } else {
          const res = await apiFetch<{ updated: number }>("/email/trash", { method: "POST", body: { ids, messageIds } });
          applyPatchLocal(ids, { folder: "trash", folderId: null });
          for (const m of chunk) {
            restorable.push({ id: m.id, folder: m.folder, folderId: m.folderId ?? null, version: m.version + 1, messageId: m.messageId });
          }
          ok += res.updated;
          failed += ids.length - res.updated;
        }
      } catch (e) {
        failed += ids.length;
        failure = e;
      }
      done += chunk.length;
      setDeleteProgress({ done, total, mode });
    }

    setDeleteProgress(null);
    return { ok, failed, total, mode, cancelled, restorable, failure };
  }

  /** Move trashed messages back to where they came from (undo) — bulk, chunked. */
  function restoreMessages(items: { id: string; folder: FolderId; folderId: string | null; version: number; messageId?: string }[]) {
    if (items.length === 0) return;
    startTransition(async () => {
      let restored = 0;
      for (let i = 0; i < items.length; i += BULK_CHUNK) {
        const chunk = items.slice(i, i + BULK_CHUNK);
        const messageIds = chunk.map((it) => it.messageId).filter((x): x is string => !!x);
        try {
          const res = await apiFetch<{ updated: number }>("/email/restore", {
            method: "POST",
            body: { items: chunk.map((it) => ({ id: it.id, folder: it.folder, folderId: it.folderId })), messageIds },
          });
          for (const it of chunk) applyPatchLocal([it.id], { folder: it.folder, folderId: it.folderId });
          restored += res.updated;
        } catch (e) {
          fail(e);
        }
      }
      if (restored > 0) toast.success(t("email.delete.restoredToast", { n: String(restored) }));
    });
  }

  function reportDelete(r: Awaited<ReturnType<typeof runDelete>>) {
    if (r.ok > 0 && r.mode === "move") {
      toast.success(t("email.delete.movedToast", { n: String(r.ok) }), {
        action: { label: t("email.delete.undo"), onClick: () => restoreMessages(r.restorable) },
      });
    }
    if (r.ok > 0 && r.mode === "purge") toast.success(t("email.delete.purgedToast", { n: String(r.ok) }));
    // Surface the real backend error when nothing succeeded (e.g. a schema/permission issue).
    if (r.ok === 0 && r.failed > 0 && r.failure) fail(r.failure);
    else if (r.failed > 0) toast.error(t("email.delete.failedToast", { n: String(r.failed) }));
    if (r.cancelled) toast.message(t("email.delete.stopped", { done: String(r.ok), total: String(r.total) }));
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

  // ── custom folders: create / rename / delete ────────
  function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const created = await apiFetch<MailFolder>(`/entities/emailFolder`, { method: "POST", body: { name, color: newFolderColor } });
        const folder: MailFolder = { id: String(created.id), name: created.name, color: created.color, version: created.version };
        setFolders((prev) => [...prev, folder].sort(byName));
        setCreatingFolder(false);
        setNewFolderName("");
        setNewFolderColor(FOLDER_COLORS[0]);
        setActiveView(`cust:${folder.id}`);
        setSelectedKey(null);
        toast.success(t("email.folders.created"));
      } catch (e) {
        fail(e);
      }
    });
  }

  function submitRename() {
    if (!editingFolder) return;
    const name = editingFolder.name.trim();
    const f = folders.find((x) => x.id === editingFolder.id);
    if (!f || !name) {
      setEditingFolder(null);
      return;
    }
    startTransition(async () => {
      try {
        const updated = await apiFetch<MailFolder>(`/entities/emailFolder/${f.id}`, {
          method: "PATCH",
          body: { name },
          headers: { "if-match": String(f.version) },
        });
        setFolders((prev) => prev.map((x) => (x.id === f.id ? { ...x, name: updated.name, version: updated.version } : x)).sort(byName));
        setEditingFolder(null);
        toast.success(t("email.folders.renamed"));
      } catch (e) {
        fail(e);
      }
    });
  }

  function deleteFolder(f: MailFolder) {
    if (!window.confirm(t("email.folders.deleteConfirm"))) return;
    startTransition(async () => {
      try {
        await apiFetch(`/email/folders/${f.id}`, { method: "DELETE" });
        setFolders((prev) => prev.filter((x) => x.id !== f.id));
        // Locally return its messages to their base folder.
        setEmails((prev) => prev.map((e) => (e.folderId === f.id ? { ...e, folderId: null } : e)));
        if (activeView === `cust:${f.id}`) selectView("inbox");
        toast.success(t("email.folders.deleted"));
      } catch (e) {
        fail(e);
      }
    });
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
        setActiveView("sent");
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
        setActiveView("drafts");
        toast.success(t("email.compose.draftSaved"));
      } catch (e) {
        fail(e);
      }
    });
  }

  function sync() {
    if (syncing) return;
    setSyncing(true);
    // A live loading toast tells the user the sync is still running; it resolves
    // in place to the result (synced / not-configured / error).
    const toastId = toast.loading(t("email.syncing"));
    startTransition(async () => {
      try {
        const res = await apiFetch<{ configured: boolean; synced: number }>("/email/sync", { method: "POST" });
        if (!res.configured) {
          toast.message(t("email.syncNotConfigured"), { id: toastId, description: t("email.syncNotConfiguredDesc") });
          return;
        }
        await reload();
        toast.success(t("email.syncedToast", { n: String(res.synced) }), { id: toastId });
        if (res.synced > 0) window.dispatchEvent(new CustomEvent("aula:mail-synced", { detail: { synced: res.synced } }));
      } catch (e) {
        toast.error(e instanceof ApiRequestError ? e.message : "Something went wrong", { id: toastId });
      } finally {
        setSyncing(false);
      }
    });
  }

  // ── rail helpers ────────────────────────────────────
  const viewName = (view: string) => (view === "starred" ? t("email.folder.starred") : t(`email.folder.${view}`));

  function viewBadge(view: string) {
    let n = 0;
    let accent = false;
    if (view === "starred") n = stats.starredCount;
    else if (view === "inbox" || view === "spam") {
      n = stats.sysUnread[view] ?? 0;
      accent = true;
    } else n = stats.sysTotal[view] ?? 0;
    if (n <= 0) return null;
    return (
      <span className={cn("ml-auto text-xs tabular-nums", accent ? "font-semibold text-primary" : "text-muted-2")}>{n}</span>
    );
  }

  function renderThreadRow(th: Thread) {
    const display = th.latest.sender || "?";
    const color = avatarColor(display);
    const isChecked = checked.has(th.key);
    return (
      <div
        className={cn(
          "group flex items-start gap-2 border-l-2 pl-2 pr-2 transition-colors",
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
            isChecked ? "border-primary bg-primary opacity-100" : "border-border-strong opacity-0 group-hover:opacity-100",
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
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleStar(th);
          }}
          aria-label={th.starred ? t("email.unstar") : t("email.star")}
          className={cn(
            "mt-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-opacity hover:bg-surface-2",
            th.starred ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <Icon name="star" className={cn("h-4 w-4", th.starred ? "animate-pop text-amber-500" : "text-muted-2")} />
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
        <Button variant="secondary" size="sm" onClick={sync} disabled={syncing || deleting} aria-busy={syncing}>
          <Icon name="recurring" className={cn("h-3.5 w-3.5 transition-transform", syncing && "animate-spin")} />
          {syncing ? t("email.syncing") : t("email.sync")}
        </Button>
      </div>

      {deleteProgress && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 animate-rise">
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
          <button
            onClick={() => {
              cancelDeleteRef.current = true;
            }}
            className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface-2"
          >
            <Icon name="square" className="h-3 w-3" />
            {t("email.delete.stop")}
          </button>
        </div>
      )}

      <div className="grid h-[calc(100vh-12rem)] min-h-[32rem] gap-3 overflow-hidden lg:grid-cols-[230px_minmax(300px,360px)_1fr]">
        {/* ── Folder rail ───────────────────────────── */}
        <aside className="flex flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-surface p-3">
          <Button className="w-full" variant="primary" size="sm" onClick={startCompose} disabled={pending}>
            <Icon name="plus" className="h-3.5 w-3.5" />
            {t("email.newMail")}
          </Button>

          <nav className="space-y-0.5">
            {SYSTEM_VIEWS.map((v) => {
              const active = activeView === v.view;
              return (
                <button
                  key={v.view}
                  onClick={() => selectView(v.view)}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all",
                    active ? "bg-primary/10 font-medium text-primary" : "text-muted hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  <Icon
                    name={v.icon}
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform group-hover:scale-110",
                      v.view === "starred" && active && "text-amber-500",
                    )}
                  />
                  <span className="truncate">{viewName(v.view)}</span>
                  {viewBadge(v.view)}
                </button>
              );
            })}
          </nav>

          {/* custom folders */}
          <div className="mt-1 flex items-center justify-between px-2.5 pt-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">{t("email.folders.section")}</span>
            <button
              onClick={() => {
                setCreatingFolder((v) => !v);
                setEditingFolder(null);
              }}
              aria-label={t("email.folders.new")}
              className="flex h-5 w-5 items-center justify-center rounded text-muted transition-colors hover:bg-surface-2 hover:text-primary"
            >
              <Icon name="plus" className="h-3.5 w-3.5" />
            </button>
          </div>

          {creatingFolder && (
            <div className="animate-rise space-y-2 rounded-lg border border-border bg-surface-2/40 p-2">
              <Input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    createFolder();
                  }
                  if (e.key === "Escape") setCreatingFolder(false);
                }}
                placeholder={t("email.folders.namePlaceholder")}
                className="h-8"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewFolderColor(c)}
                    aria-label={t("email.folders.color")}
                    className={cn(
                      "h-5 w-5 rounded-full transition-transform hover:scale-110",
                      newFolderColor === c && "ring-2 ring-foreground ring-offset-1 ring-offset-surface",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setCreatingFolder(false);
                    setNewFolderName("");
                  }}
                >
                  {t("email.compose.discard")}
                </Button>
                <Button variant="primary" size="sm" onClick={createFolder} disabled={!newFolderName.trim() || pending}>
                  {t("email.folders.create")}
                </Button>
              </div>
            </div>
          )}

          <nav className="space-y-0.5">
            {folders.length === 0 && !creatingFolder && (
              <p className="px-2.5 py-1 text-xs text-muted-2">{t("email.folders.empty")}</p>
            )}
            {folders.map((f) => {
              const view = `cust:${f.id}`;
              const active = activeView === view;
              const n = stats.custTotal[f.id] ?? 0;
              if (editingFolder?.id === f.id) {
                return (
                  <div key={f.id} className="animate-rise flex items-center gap-1 px-0.5 py-0.5">
                    <Input
                      autoFocus
                      value={editingFolder.name}
                      onChange={(e) => setEditingFolder({ id: f.id, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          submitRename();
                        }
                        if (e.key === "Escape") setEditingFolder(null);
                      }}
                      className="h-8"
                    />
                    <button
                      onClick={submitRename}
                      aria-label={t("email.folders.rename")}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary hover:bg-surface-2"
                    >
                      <Icon name="check" className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditingFolder(null)}
                      aria-label={t("email.compose.discard")}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
                    >
                      <Icon name="close" className="h-4 w-4" />
                    </button>
                  </div>
                );
              }
              return (
                <div key={f.id} className="group relative flex items-center">
                  <button
                    onClick={() => selectView(view)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-2 pl-2.5 pr-7 text-sm transition-all",
                      active ? "bg-primary/10 font-medium text-primary" : "text-muted hover:bg-surface-2 hover:text-foreground",
                    )}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.color || "#64748b" }} />
                    <span className="truncate">{f.name}</span>
                  </button>
                  <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
                    {n > 0 && <span className="text-xs tabular-nums text-muted-2 group-hover:hidden">{n}</span>}
                    <div className="hidden group-hover:block">
                      <DropdownMenu
                        align="end"
                        trigger={({ toggle }) => (
                          <button
                            onClick={toggle}
                            aria-label={f.name}
                            className="flex h-5 w-5 items-center justify-center rounded text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                          >
                            <Icon name="settings" className="h-3.5 w-3.5" />
                          </button>
                        )}
                      >
                        {({ close }) => (
                          <>
                            <MenuItem
                              onClick={() => {
                                setEditingFolder({ id: f.id, name: f.name });
                                setCreatingFolder(false);
                                close();
                              }}
                            >
                              <Icon name="edit" className="h-3.5 w-3.5" />
                              {t("email.folders.rename")}
                            </MenuItem>
                            <MenuItem
                              danger
                              onClick={() => {
                                close();
                                deleteFolder(f);
                              }}
                            >
                              <Icon name="trash" className="h-3.5 w-3.5" />
                              {t("email.folders.delete")}
                            </MenuItem>
                          </>
                        )}
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
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
                    {moveTargets.length > 0 && activeView !== "drafts" && (
                      <DropdownMenu
                        align="end"
                        panelClassName="w-52"
                        trigger={({ toggle }) => (
                          <button
                            onClick={toggle}
                            disabled={pending || deleting}
                            className="flex items-center gap-1 rounded-md px-2 py-1 text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
                          >
                            <Icon name="transfer" className="h-3.5 w-3.5" />
                            {t("email.move.button")}
                          </button>
                        )}
                      >
                        {({ close }) =>
                          renderMoveItems(
                            threads.filter((th) => checked.has(th.key)).flatMap((th) => th.msgs),
                            close,
                          )
                        }
                      </DropdownMenu>
                    )}
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
            <div className="flex flex-1 flex-col overflow-hidden animate-rise">
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
                <p className="px-1 text-[11px] text-muted-2">{t("email.compose.recipientsHint")}</p>
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
            </div>
          ) : selected ? (
            <div className="flex flex-1 flex-col overflow-hidden animate-fade">
              <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleStar(selected)}
                  disabled={pending}
                  aria-label={selected.starred ? t("email.unstar") : t("email.star")}
                >
                  <Icon name="star" className={cn("h-4 w-4", selected.starred ? "animate-pop text-amber-500" : "")} />
                </Button>
                {moveTargets.length > 0 && (
                  <DropdownMenu
                    align="end"
                    panelClassName="w-52"
                    trigger={({ toggle }) => (
                      <Button variant="ghost" size="sm" onClick={toggle} disabled={pending} aria-label={t("email.move.button")}>
                        <Icon name="transfer" className="h-4 w-4" />
                      </Button>
                    )}
                  >
                    {({ close }) => renderMoveItems(selected.msgs, close)}
                  </DropdownMenu>
                )}
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
            </div>
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
