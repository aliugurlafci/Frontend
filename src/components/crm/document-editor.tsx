"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { EntityDef, EntityRecord } from "@/lib/metadata/types";
import { apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/finance/money";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { LineItemsEditor, type EditableLine } from "./line-items-editor";
import { PaymentsPanel } from "./payments-panel";
import { enumTone } from "./field-format";

interface DocResult {
  doc: EntityRecord;
  lines: EntityRecord[];
}
interface TransitionOption {
  action: string;
  to: string;
}

export function DocumentEditor({
  entity,
  apiBase,
  id,
  accounts,
  products,
  dateFields,
  convert,
  showPayments,
}: {
  entity: EntityDef;
  apiBase: string; // e.g. "/quotes"
  id: string; // "new" or document id
  accounts: EntityRecord[];
  products: EntityRecord[];
  dateFields: { name: string; label: string }[];
  convert?: { label: string };
  showPayments?: boolean;
}) {
  const router = useRouter();
  const isNew = id === "new";
  const currencyField = entity.fields.find((f) => f.name === "currencyCode")!;
  const statusField = entity.fields.find((f) => f.name === "status")!;

  const [doc, setDoc] = useState<EntityRecord | null>(null);
  const [header, setHeader] = useState<Record<string, unknown>>({ currencyCode: "USD" });
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [actions, setActions] = useState<TransitionOption[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await apiFetch<DocResult>(`${apiBase}/${id}`);
    setDoc(res.doc);
    setHeader({ ...res.doc });
    setLines(
      res.lines.map((l) => ({
        productId: (l.productId as string) ?? null,
        description: String(l.description ?? ""),
        qty: typeof l.qty === "number" ? l.qty : 0,
        unitPrice: typeof l.unitPrice === "number" ? l.unitPrice : 0,
        taxRate: typeof l.taxRate === "number" ? l.taxRate : 0,
      })),
    );
    const tr = await apiFetch<{ actions: TransitionOption[] }>(`/entities/${entity.name}/${id}/transitions`);
    setActions(tr.actions);
  }

  useEffect(() => {
    if (isNew) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((e) => toast.error((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const currency = String(header.currencyCode ?? "USD");
  function setField(name: string, value: unknown) {
    setHeader((h) => ({ ...h, [name]: value }));
  }
  function flatHeader() {
    const out: Record<string, unknown> = {
      accountId: header.accountId ?? null,
      currencyCode: currency,
      notes: header.notes ?? null,
    };
    for (const d of dateFields) out[d.name] = header[d.name] ?? null;
    return out;
  }

  async function save() {
    if (!header.accountId) {
      toast.error("Please choose an account");
      return;
    }
    setBusy(true);
    try {
      if (isNew) {
        const res = await apiFetch<DocResult>(apiBase, { method: "POST", body: { ...flatHeader(), lines } });
        toast.success(`${entity.label} created`);
        router.push(`/${entity.name}/${res.doc.id}`);
      } else {
        await apiFetch<DocResult>(`${apiBase}/${id}`, { method: "PUT", body: { header: flatHeader(), lines } });
        toast.success(`${entity.label} saved`);
        await load();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: string) {
    setBusy(true);
    try {
      await apiFetch(`/entities/${entity.name}/${id}/transitions`, { method: "POST", body: { action } });
      toast.success(action);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doConvert() {
    setBusy(true);
    try {
      const res = await apiFetch<{ invoiceId: string }>(`${apiBase}/${id}/convert`, { method: "POST" });
      toast.success("Converted to invoice");
      router.push(`/invoice/${res.invoiceId}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href={`/${entity.name}`} className="text-sm text-muted hover:text-foreground">
            <Icon name="chevronLeft" className="inline h-4 w-4" /> {entity.pluralLabel}
          </Link>
          <h1 className="text-lg font-semibold">{isNew ? `New ${entity.label}` : String(doc?.number ?? entity.label)}</h1>
          {doc && <Badge tone={enumTone(statusField, doc.status)}>{String(doc.status)}</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isNew &&
            actions.map((a) => (
              <Button key={a.action} size="sm" disabled={busy} onClick={() => runAction(a.action)}>
                {a.action}
              </Button>
            ))}
          {!isNew && convert && (
            <Button size="sm" disabled={busy} onClick={doConvert}>
              {convert.label}
            </Button>
          )}
          {!isNew && (
            <a
              href={`/${entity.name}/${id}/print`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-surface-2"
            >
              <Icon name="download" className="h-3.5 w-3.5" /> PDF
            </a>
          )}
          <Button variant="primary" size="sm" loading={busy} onClick={save}>
            Save
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader title="Details" />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="account" required>
              Account
            </Label>
            <Select id="account" value={String(header.accountId ?? "")} onChange={(e) => setField("accountId", e.target.value || null)}>
              <option value="">— Select —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {String(a.name)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select id="currency" value={currency} onChange={(e) => setField("currencyCode", e.target.value)}>
              {currencyField.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          {dateFields.map((d) => (
            <div key={d.name}>
              <Label htmlFor={d.name}>{d.label}</Label>
              <Input
                id={d.name}
                type="date"
                value={String(header[d.name] ?? "")}
                onChange={(e) => setField(d.name, e.target.value || null)}
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={String(header.notes ?? "")} onChange={(e) => setField("notes", e.target.value)} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Line items" />
        <CardBody>
          <LineItemsEditor lines={lines} products={products} currencyCode={currency} onChange={setLines} />
        </CardBody>
      </Card>

      {!isNew && doc && showPayments && (
        <Card>
          <CardHeader title="Payments" />
          <CardBody>
            <PaymentsPanel
              invoiceId={doc.id}
              currencyCode={currency}
              balance={typeof doc.balance === "number" ? doc.balance : 0}
              onPaid={load}
            />
          </CardBody>
        </Card>
      )}

      {!isNew && doc && (
        <p className="text-right text-sm font-semibold">
          Total: {formatMoney(typeof doc.total === "number" ? doc.total : 0, currency)}
        </p>
      )}
    </div>
  );
}
