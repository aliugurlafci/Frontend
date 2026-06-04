"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export interface MessageRecord {
  id: string;
  peer: string;
  author: string | null;
  body: string;
  fromMe: boolean;
  createdAt: string;
  version: number;
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

/** Real-time chat over WebSocket, backed by the `chatMessage` entity. */
export function ChatBoard({ initial, me }: { initial: MessageRecord[]; me: string }) {
  const [messages, setMessages] = useState<MessageRecord[]>(initial);
  const [activePeer, setActivePeer] = useState<string | null>(initial[0]?.peer ?? null);
  const [draft, setDraft] = useState("");
  const [newPeer, setNewPeer] = useState("");
  const [composingNew, setComposingNew] = useState(false);
  const [connected, setConnected] = useState(false);
  const [pending, startTransition] = useTransition();
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const mine = (m: MessageRecord) => (m.author ? m.author === me : m.fromMe);

  function addMessage(record: MessageRecord) {
    setMessages((prev) => (prev.some((m) => m.id === record.id) ? prev : [...prev, record]));
  }

  // Live connection to the backend chat WebSocket.
  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;
    const actor = readCookie("aula_actor") || "admin";
    const tenant = readCookie("aula_tenant") || "";

    function connect() {
      const url = `${wsBase()}/ws/chat?actor=${encodeURIComponent(actor)}${tenant ? `&tenant=${encodeURIComponent(tenant)}` : ""}`;
      const socket = new WebSocket(url);
      socketRef.current = socket;
      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 2000); // auto-reconnect
      };
      socket.onerror = () => socket.close();
      socket.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as { type: string; record?: MessageRecord; message?: string };
          if (data.type === "message" && data.record) addMessage(data.record);
          else if (data.type === "error" && data.message) toast.error(data.message);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conversations = useMemo(() => {
    const byPeer = new Map<string, MessageRecord[]>();
    for (const m of messages) {
      const arr = byPeer.get(m.peer) ?? [];
      arr.push(m);
      byPeer.set(m.peer, arr);
    }
    return [...byPeer.entries()]
      .map(([peer, msgs]) => {
        const sorted = [...msgs].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
        return { peer, last: sorted[sorted.length - 1] };
      })
      .sort((a, b) => (a.last.createdAt < b.last.createdAt ? 1 : -1));
  }, [messages]);

  const thread = useMemo(
    () => messages.filter((m) => m.peer === activePeer).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [messages, activePeer],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread.length]);

  function fail(e: unknown) {
    toast.error(e instanceof ApiRequestError ? e.message : "Something went wrong");
  }

  function send() {
    const body = draft.trim();
    if (!body || !activePeer) return;
    setDraft("");
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Persisted server-side, then echoed back to every client (incl. us).
      socket.send(JSON.stringify({ type: "send", peer: activePeer, body }));
      return;
    }
    // Fallback when the socket isn't open: persist over REST and append locally.
    startTransition(async () => {
      try {
        const created = await apiFetch<MessageRecord>("/entities/chatMessage", {
          method: "POST",
          body: { peer: activePeer, author: me, body, fromMe: true },
        });
        addMessage(created);
      } catch (e) {
        fail(e);
      }
    });
  }

  function startNew() {
    const p = newPeer.trim();
    if (!p) return;
    setActivePeer(p);
    setComposingNew(false);
    setNewPeer("");
  }

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
        <Button variant="secondary" size="sm" onClick={() => setComposingNew((v) => !v)}>
          <Icon name="plus" className="h-3.5 w-3.5" />
          New chat
        </Button>
      </div>

      {composingNew && (
        <Card>
          <form
            className="flex items-center gap-2 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              startNew();
            }}
          >
            <Input value={newPeer} onChange={(e) => setNewPeer(e.target.value)} placeholder="Contact name" className="flex-1" autoFocus />
            <Button type="submit" variant="primary" size="sm">
              Start
            </Button>
          </form>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="overflow-hidden">
          {conversations.length === 0 && !activePeer ? (
            <p className="p-4 text-sm text-muted">No conversations yet. Start a new chat.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activePeer && !conversations.some((c) => c.peer === activePeer) && (
                <li>
                  <button className="flex w-full items-center gap-3 bg-surface-2 px-4 py-3 text-left">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials(activePeer)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-sm font-medium text-foreground">{activePeer}</span>
                      <p className="truncate text-xs text-muted">New conversation</p>
                    </div>
                  </button>
                </li>
              )}
              {conversations.map((c) => (
                <li key={c.peer}>
                  <button
                    onClick={() => setActivePeer(c.peer)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2",
                      activePeer === c.peer && "bg-surface-2",
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials(c.peer)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{c.peer}</span>
                        <span className="shrink-0 text-xs text-muted-2">{c.last.createdAt.slice(11, 16)}</span>
                      </div>
                      <p className="truncate text-xs text-muted">{c.last.body}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex h-[560px] flex-col">
          {activePeer ? (
            <>
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {initials(activePeer)}
                </div>
                <span className="text-sm font-semibold">{activePeer}</span>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {thread.length === 0 && <p className="text-center text-sm text-muted">No messages yet. Say hello 👋</p>}
                {thread.map((m) => (
                  <div key={m.id} className={cn("flex", mine(m) ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                        mine(m) ? "bg-primary text-primary-foreground" : "bg-surface-2 text-foreground",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className={cn("mt-0.5 text-[10px]", mine(m) ? "text-primary-foreground/70" : "text-muted-2")}>
                        {m.createdAt.slice(11, 16)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <form
                className="flex items-center gap-2 border-t border-border p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message..." />
                <Button type="submit" variant="primary" size="md" disabled={pending}>
                  <Icon name="chat" className="h-4 w-4" />
                  Send
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted">Select or start a conversation.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
