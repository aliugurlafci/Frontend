"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

type CallType = "incoming" | "outgoing" | "missed";

export interface CallRecord {
  id: string;
  contact: string;
  type: CallType;
  durationSec: number;
  createdAt: string;
  version: number;
}

const TYPE_TONE: Record<CallType, Tone> = { incoming: "success", outgoing: "info", missed: "danger" };
const FILTERS: { id: "all" | CallType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "incoming", label: "Incoming" },
  { id: "outgoing", label: "Outgoing" },
  { id: "missed", label: "Missed" },
];

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}
function fmtDuration(sec: number): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
/** Parse "mm:ss" or a plain seconds count into seconds. */
function parseDuration(raw: string): number {
  const t = raw.trim();
  if (!t) return 0;
  if (t.includes(":")) {
    const [m, s] = t.split(":");
    return Math.max(0, (Number(m) || 0) * 60 + (Number(s) || 0));
  }
  return Math.max(0, Math.floor(Number(t) || 0));
}

/** Call history backed by the `call` entity (persists to the backend/DB). */
export function CallsBoard({ initial }: { initial: CallRecord[] }) {
  const [calls, setCalls] = useState<CallRecord[]>(initial);
  const [filter, setFilter] = useState<"all" | CallType>("all");
  const [confirmClear, setConfirmClear] = useState(false);
  const [logging, setLogging] = useState(false);
  const [contact, setContact] = useState("");
  const [type, setType] = useState<CallType>("outgoing");
  const [duration, setDuration] = useState("");
  const [pending, startTransition] = useTransition();

  const rows = filter === "all" ? calls : calls.filter((c) => c.type === filter);

  function fail(e: unknown) {
    toast.error(e instanceof ApiRequestError ? e.message : "Something went wrong");
  }

  function log() {
    const name = contact.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const created = await apiFetch<CallRecord>("/entities/call", {
          method: "POST",
          body: { contact: name, type, durationSec: type === "missed" ? 0 : parseDuration(duration) },
        });
        setCalls((prev) => [created, ...prev]);
        setContact("");
        setDuration("");
        setType("outgoing");
        setLogging(false);
      } catch (e) {
        fail(e);
      }
    });
  }

  function deleteCall(c: CallRecord) {
    startTransition(async () => {
      try {
        await apiFetch(`/entities/call/${c.id}`, { method: "DELETE", headers: { "if-match": String(c.version) } });
        setCalls((prev) => prev.filter((x) => x.id !== c.id));
      } catch (e) {
        fail(e);
      }
    });
  }

  function clearAll() {
    const snapshot = calls;
    startTransition(async () => {
      try {
        await Promise.all(
          snapshot.map((c) =>
            apiFetch(`/entities/call/${c.id}`, { method: "DELETE", headers: { "if-match": String(c.version) } }),
          ),
        );
        setCalls([]);
      } catch (e) {
        fail(e);
      } finally {
        setConfirmClear(false);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Call History</h1>
          <p className="text-xs text-muted">Track incoming, outgoing, and missed calls</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="primary" size="sm" type="button" onClick={() => setLogging((v) => !v)} disabled={pending}>
            <Icon name="plus" className="h-3.5 w-3.5" />
            Log call
          </Button>
          {calls.length > 0 &&
            (confirmClear ? (
              <>
                <Button variant="danger" size="sm" type="button" onClick={clearAll} disabled={pending}>
                  <Icon name="trash" className="h-3.5 w-3.5" />
                  Confirm clear
                </Button>
                <Button variant="ghost" size="sm" type="button" onClick={() => setConfirmClear(false)}>
                  <Icon name="close" className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" type="button" onClick={() => setConfirmClear(true)}>
                <Icon name="trash" className="h-3.5 w-3.5" />
                Clear all
              </Button>
            ))}
        </div>
      </div>

      {logging && (
        <Card>
          <form
            className="flex flex-wrap items-center gap-2 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              log();
            }}
          >
            <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact name" className="flex-1 min-w-40" />
            <Select value={type} onChange={(e) => setType(e.target.value as CallType)} className="w-32">
              <option value="outgoing">Outgoing</option>
              <option value="incoming">Incoming</option>
              <option value="missed">Missed</option>
            </Select>
            <Input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="mm:ss"
              className="w-24"
              disabled={type === "missed"}
            />
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              Save
            </Button>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:bg-surface-2",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-2">
              <th className="px-4 py-2.5">Contact</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Duration</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                  No calls to show.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {initials(c.contact)}
                      </div>
                      <span className="font-medium text-foreground">{c.contact}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={TYPE_TONE[c.type]}>
                      <Icon name="call" className="mr-1 h-3 w-3" />
                      {c.type.charAt(0).toUpperCase() + c.type.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{fmtDuration(c.durationSec)}</td>
                  <td className="px-4 py-3 text-muted">{c.createdAt.slice(0, 10)} {c.createdAt.slice(11, 16)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="xs"
                      type="button"
                      aria-label={`Delete call with ${c.contact}`}
                      onClick={() => deleteCall(c)}
                      disabled={pending}
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
