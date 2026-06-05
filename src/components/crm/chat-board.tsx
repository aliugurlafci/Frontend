"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch, apiUpload, ApiRequestError } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { EmojiPicker } from "./emoji-picker";
import { cn } from "@/lib/utils/cn";

interface Attachment {
  fileId: string;
  name: string;
  kind: "image" | "file";
  sizeKb?: number;
}
interface ChatMessage {
  id: string;
  conversationId: string;
  fromUserId: string;
  author: string | null;
  body: string | null;
  attachments: Attachment[];
  createdAt: string;
}
interface Conversation {
  conversationId: string;
  participants: string[];
  title: string;
  last: { body: string | null; author: string | null; createdAt: string; fromUserId: string | null; hasAttachments: boolean };
}
interface ChatUser {
  id: string;
  displayName: string;
  email: string;
  role: string;
  roleLabel: string;
  isAdmin: boolean;
  branchId: string | null;
  branchName: string | null;
  dealerId: string | null;
  dealerName: string | null;
}
interface ActiveConv {
  id: string;
  title: string;
  participants: string[];
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function wsBase(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.hostname}:4000`;
  }
  return "ws://localhost:4000";
}

/** Deterministic conversation key (sorted numeric participant ids) — mirrors the backend. */
function convKey(ids: Array<string | number>): string {
  const uniq = [...new Set(ids.map(String).filter((x) => /^\d+$/.test(x)))];
  uniq.sort((a, b) => Number(a) - Number(b));
  return uniq.join("-");
}

function parseAttachments(v: unknown): Attachment[] {
  if (typeof v !== "string" || !v) return [];
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) ? (a as Attachment[]) : [];
  } catch {
    return [];
  }
}

function normalize(raw: Record<string, unknown>): ChatMessage {
  return {
    id: String(raw.id),
    conversationId: String(raw.conversationId ?? ""),
    fromUserId: String(raw.fromUserId ?? ""),
    author: (raw.author as string | null) ?? null,
    body: (raw.body as string | null) ?? null,
    attachments: parseAttachments(raw.attachments),
    createdAt: String(raw.createdAt ?? ""),
  };
}

const fileUrl = (id: string, inline = false) => `/api/v1/files/${id}/download${inline ? "?inline=1" : ""}`;

/** Group label for the user picker (Merkez/Şube via branch, Bayi via dealer). */
function groupOf(u: ChatUser): string {
  if (u.dealerId) return `Bayi · ${u.dealerName ?? u.dealerId}`;
  if (u.branchId) return u.branchName ?? `Şube ${u.branchId}`;
  return "Diğer";
}

/** Real-time direct/group chat, backed by the `/chat/*` API + the chat WebSocket. */
export function ChatBoard({ meId, meName, isAdmin }: { meId: string; meName: string; isAdmin: boolean }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<ActiveConv | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [connected, setConnected] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState("");

  const socketRef = useRef<WebSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeIdRef.current = active?.id ?? null;
  }, [active]);

  const loadConversations = useCallback(async () => {
    try {
      const r = await apiFetch<{ conversations: Conversation[] }>("/chat/conversations");
      setConversations(r.conversations);
    } catch {
      /* ignore */
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const r = await apiFetch<{ items: Record<string, unknown>[] }>(
        `/chat/messages?conversationId=${encodeURIComponent(conversationId)}`,
      );
      setMessages(r.items.map(normalize));
    } catch {
      setMessages([]);
    }
  }, []);

  // Initial load: conversations + open the most recent.
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch<{ conversations: Conversation[] }>("/chat/conversations");
        setConversations(r.conversations);
        const first = r.conversations[0];
        if (first) {
          setActive({ id: first.conversationId, title: first.title, participants: first.participants });
          loadMessages(first.conversationId);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [loadMessages]);

  // Live WebSocket connection.
  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;
    const actor = readCookie("aula_actor") || meId;
    const tenant = readCookie("aula_tenant") || "";

    function connect() {
      const url = `${wsBase()}/ws/chat?actor=${encodeURIComponent(actor)}${tenant ? `&tenant=${encodeURIComponent(tenant)}` : ""}`;
      const socket = new WebSocket(url);
      socketRef.current = socket;
      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 2000);
      };
      socket.onerror = () => socket.close();
      socket.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as { type: string; record?: Record<string, unknown>; message?: string };
          if (data.type === "message" && data.record) {
            const msg = normalize(data.record);
            if (msg.conversationId === activeIdRef.current) {
              setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
            }
            loadConversations();
          } else if (data.type === "error" && data.message) {
            toast.error(data.message);
          }
        } catch {
          /* ignore malformed frame */
        }
      };
    }

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      socketRef.current?.close();
    };
  }, [meId, loadConversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, active?.id]);

  function openConversation(c: Conversation) {
    setActive({ id: c.conversationId, title: c.title, participants: c.participants });
    loadMessages(c.conversationId);
  }

  async function openPicker() {
    setSelected(new Set());
    setUserSearch("");
    setPickerOpen(true);
    try {
      const r = await apiFetch<{ users: ChatUser[] }>("/chat/users");
      setUsers(r.users);
    } catch {
      toast.error("Kullanıcılar yüklenemedi");
    }
  }

  function startChatWith(ids: string[], titleNames: string[]) {
    if (ids.length === 0) return;
    const id = convKey([...ids, meId]);
    setActive({ id, title: titleNames.join(", ") || "Sohbet", participants: [...ids, meId] });
    setPickerOpen(false);
    loadMessages(id);
  }

  function confirmPicker() {
    const ids = [...selected];
    const names = users.filter((u) => selected.has(u.id)).map((u) => u.displayName);
    startChatWith(ids, names);
  }

  function messageAdmin() {
    const admin = users.find((u) => u.isAdmin) ?? null;
    if (admin) startChatWith([admin.id], [admin.displayName]);
  }

  async function attachFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: Attachment[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("folder", "chat");
        form.append("file", file);
        const rec = await apiUpload<{ id: string; name: string; sizeKb: number }>("/files/upload", form);
        uploaded.push({
          fileId: String(rec.id),
          name: String(rec.name ?? file.name),
          kind: file.type.startsWith("image/") ? "image" : "file",
          sizeKb: rec.sizeKb,
        });
      }
      setAtts((prev) => [...prev, ...uploaded]);
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Dosya yüklenemedi");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function send() {
    const body = draft.trim();
    if ((!body && atts.length === 0) || !active) return;
    const attachments = atts;
    setDraft("");
    setAtts([]);
    const payload = { conversationId: active.id, body, attachments };
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "send", ...payload }));
      return; // echoed back over WS + sidebar refresh on receive
    }
    try {
      const created = await apiFetch<Record<string, unknown>>("/chat/messages", { method: "POST", body: payload });
      setMessages((prev) => [...prev, normalize(created)]);
      loadConversations();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Mesaj gönderilemedi");
    }
  }

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const list = q ? users.filter((u) => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : users;
    const groups = new Map<string, ChatUser[]>();
    for (const u of list) (groups.get(groupOf(u)) ?? groups.set(groupOf(u), []).get(groupOf(u))!).push(u);
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [users, userSearch]);

  const mine = (m: ChatMessage) => String(m.fromUserId) === String(meId);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Chat</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-success" : "bg-muted-2")} />
            {connected ? "Live" : "Connecting…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && (
            <Button variant="outline" size="sm" onClick={() => void openPicker().then(messageAdmin)}>
              Message admin
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => void openPicker()}>
            <Icon name="plus" className="h-3.5 w-3.5" />
            New chat
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card className="overflow-hidden">
          {conversations.length === 0 && !active ? (
            <p className="p-4 text-sm text-muted">Henüz konuşma yok. &quot;New chat&quot; ile başlayın.</p>
          ) : (
            <ul className="divide-y divide-border">
              {active && !conversations.some((c) => c.conversationId === active.id) && (
                <li>
                  <button className="flex w-full items-center gap-3 bg-surface-2 px-4 py-3 text-left">
                    <Avatar name={active.title} />
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-sm font-medium text-foreground">{active.title}</span>
                      <p className="truncate text-xs text-muted">Yeni konuşma</p>
                    </div>
                  </button>
                </li>
              )}
              {conversations.map((c) => (
                <li key={c.conversationId}>
                  <button
                    onClick={() => openConversation(c)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2",
                      active?.id === c.conversationId && "bg-surface-2",
                    )}
                  >
                    <Avatar name={c.title} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{c.title}</span>
                        <span className="shrink-0 text-xs text-muted-2">{c.last.createdAt.slice(11, 16)}</span>
                      </div>
                      <p className="truncate text-xs text-muted">
                        {c.last.hasAttachments && !c.last.body ? "📎 Ek" : c.last.body ?? ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex h-[600px] flex-col">
          {active ? (
            <>
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Avatar name={active.title} />
                <div className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{active.title}</span>
                  {active.participants.length > 2 && (
                    <span className="text-xs text-muted">{active.participants.length} kişi</span>
                  )}
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && <p className="text-center text-sm text-muted">Henüz mesaj yok. Merhaba deyin 👋</p>}
                {messages.map((m) => (
                  <div key={m.id} className={cn("flex flex-col", mine(m) ? "items-end" : "items-start")}>
                    {!mine(m) && active.participants.length > 2 && (
                      <span className="mb-0.5 px-1 text-[10px] text-muted-2">{m.author}</span>
                    )}
                    <div
                      className={cn(
                        "max-w-[78%] rounded-2xl px-3 py-2 text-sm",
                        mine(m) ? "bg-primary text-primary-foreground" : "bg-surface-2 text-foreground",
                      )}
                    >
                      {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                      {m.attachments.length > 0 && (
                        <div className={cn("space-y-1.5", m.body && "mt-1.5")}>
                          {m.attachments.map((a) =>
                            a.kind === "image" ? (
                              <a key={a.fileId} href={fileUrl(a.fileId, true)} target="_blank" rel="noopener noreferrer" className="block">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={fileUrl(a.fileId, true)} alt={a.name} className="max-h-48 w-auto rounded-lg" />
                              </a>
                            ) : (
                              <a
                                key={a.fileId}
                                href={fileUrl(a.fileId)}
                                className={cn(
                                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs underline-offset-2 hover:underline",
                                  mine(m) ? "bg-primary-foreground/15" : "bg-surface",
                                )}
                              >
                                <Icon name="file" className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{a.name}</span>
                                {a.sizeKb ? <span className="shrink-0 opacity-70">{a.sizeKb} KB</span> : null}
                              </a>
                            ),
                          )}
                        </div>
                      )}
                      <p className={cn("mt-0.5 text-[10px]", mine(m) ? "text-primary-foreground/70" : "text-muted-2")}>
                        {m.createdAt.slice(11, 16)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {atts.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-border px-3 pt-2">
                  {atts.map((a, i) => (
                    <span key={a.fileId} className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2 py-1 text-xs">
                      <Icon name={a.kind === "image" ? "paperclip" : "file"} className="h-3.5 w-3.5" />
                      <span className="max-w-32 truncate">{a.name}</span>
                      <button
                        type="button"
                        aria-label="Remove attachment"
                        onClick={() => setAtts((prev) => prev.filter((_, j) => j !== i))}
                        className="text-muted-2 hover:text-danger"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <form
                className="flex items-center gap-2 border-t border-border p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <EmojiPicker onPick={(emoji) => setDraft((d) => d + emoji)} />
                <button
                  type="button"
                  aria-label="Attach files"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  {uploading ? <Spinner className="h-4 w-4" /> : <Icon name="paperclip" className="h-4 w-4" />}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => attachFiles(e.target.files)}
                />
                <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Mesaj yazın..." className="flex-1" />
                <Button type="submit" variant="primary" size="md" disabled={uploading}>
                  <Icon name="chat" className="h-4 w-4" />
                  Gönder
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted">Bir konuşma seçin veya başlatın.</p>
            </div>
          )}
        </Card>
      </div>

      <Drawer
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Yeni sohbet"
        footer={
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted">{selected.size} seçili</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setPickerOpen(false)}>
                İptal
              </Button>
              <Button size="sm" variant="primary" onClick={confirmPicker} disabled={selected.size === 0}>
                Başlat
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-muted">Ana şirket ve bayi/şube kullanıcılarından bir (DM) veya birden fazla (grup) kişi seçin.</p>
          <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Kullanıcı ara..." autoFocus />
          {filteredUsers.length === 0 && <p className="text-sm text-muted">Kullanıcı bulunamadı.</p>}
          {filteredUsers.map(([group, list]) => (
            <div key={group}>
              <p className="mb-1 px-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-2">{group}</p>
              <ul className="space-y-0.5">
                {list.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(u.id)) next.delete(u.id);
                          else next.add(u.id);
                          return next;
                        })
                      }
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2",
                        selected.has(u.id) && "bg-primary/10",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]",
                          selected.has(u.id) ? "border-primary bg-primary text-primary-foreground" : "border-border-strong",
                        )}
                        aria-hidden
                      >
                        {selected.has(u.id) ? "✓" : ""}
                      </span>
                      <Avatar name={u.displayName} sm />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-foreground">{u.displayName}</span>
                          {u.isAdmin && <Badge tone="warning">Admin</Badge>}
                        </span>
                        <span className="block truncate text-xs text-muted">{u.roleLabel || u.email}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  );
}

function Avatar({ name, sm }: { name: string; sm?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary",
        sm ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs",
      )}
    >
      {initials(name)}
    </div>
  );
}
