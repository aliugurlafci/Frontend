"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";

interface Endpoint {
  id: string;
  url: string;
  events: string[];
  secret: string;
}
interface Delivery {
  id: string;
  type: string;
  ok: boolean;
  status: number | null;
  at: string;
  error?: string;
}

export function RunJobsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const r = await apiFetch<{ results: { name: string; summary: string }[] }>(`/cron/tick`, { method: "POST" });
      toast.success(r.results.map((x) => x.summary).join(" · ") || "Done");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" loading={busy} onClick={run}>
      <Icon name="recurring" className="h-3.5 w-3.5" /> Run now
    </Button>
  );
}

export function WebhookManager() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState("*");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await apiFetch<{ endpoints: Endpoint[]; deliveries: Delivery[] }>(`/webhooks`);
      setEndpoints(r.endpoints);
      setDeliveries(r.deliveries);
    } catch {
      /* ignore (non-admin) */
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function add() {
    if (!url) {
      toast.error("Endpoint URL is required");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/webhooks`, {
        method: "POST",
        body: { url, events: events.split(",").map((s) => s.trim()).filter(Boolean) },
      });
      toast.success("Webhook added");
      setUrl("");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiFetch(`/webhooks/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function test(id: string) {
    try {
      await apiFetch(`/webhooks/${id}/test`, { method: "POST" });
      toast.success("Test ping sent");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <div>
          <Label htmlFor="wh-url">Endpoint URL</Label>
          <Input
            id="wh-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:3000/api/v1/webhooks/echo"
          />
        </div>
        <div>
          <Label htmlFor="wh-events">Events</Label>
          <Input id="wh-events" value={events} onChange={(e) => setEvents(e.target.value)} placeholder="* or deal.win, invoice.send" />
        </div>
        <Button variant="primary" size="sm" loading={busy} onClick={add}>
          Add
        </Button>
      </div>

      {endpoints.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {endpoints.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{e.url}</div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {e.events.map((ev) => (
                    <Badge key={ev} tone="neutral">
                      {ev}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="xs" onClick={() => test(e.id)}>
                  Test
                </Button>
                <button onClick={() => remove(e.id)} aria-label="Delete webhook" className="p-1 text-muted hover:text-danger">
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deliveries.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase text-muted-2">Recent deliveries</div>
          <ul className="space-y-1 text-xs">
            {deliveries.slice(0, 8).map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <span>
                  <Badge tone={d.ok ? "success" : "danger"}>{d.ok ? "ok" : "fail"}</Badge> {d.type}
                  {d.status ? ` · ${d.status}` : ""}
                  {d.error ? ` · ${d.error}` : ""}
                </span>
                <span className="text-muted">{new Date(d.at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
