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
import { enumTone } from "./field-format";

interface DocResult {
  doc: EntityRecord;
  lines: EntityRecord[];
  payments?: EntityRecord[];
}
interface TransitionOption {
  action: string;
  to: string;
}

const DATE_FIELDS: Record<"po" | "bill", { name: string; label: string }[]> = {
  po: [
    { name: "orderDate", label: "Order Date" },
    { name: "expectedDate", label: "Expected Date" },
  ],
  bill: [
    { name: "billDate", label: "Bill Date" },
    { name: "dueDate", label: "Due Date" },
  ],
};

/** Supplier-side document editor shared by purchase orders and vendor bills.
 *  Reuses the product line grid; differs by header fields (warehouse for PO,
 *  goods-receipt link + payments for bills) and post/receive actions. */
export function PurchaseDocEditor({
  entity,
  apiBase,
  id,
  mode,
  suppliers,
  products,
  warehouses,
  goodsReceipts,
}: {
  entity: EntityDef;
  apiBase: string; // "/purchase-orders" | "/vendor-bills"
  id: string;
  mode: "po" | "bill";
  suppliers: EntityRecord[];
  products: EntityRecord[];
  warehouses: EntityRecord[];
  goodsReceipts: EntityRecord[];
}) {
  const router = useRouter();
  const isNew = id === "new";
  const statusField = entity.fields.find((f) => f.name === "status")!;
  const currencyField = entity.fields.find((f) => f.name === "currencyCode")!;
  const dateFields = DATE_FIELDS[mode];

  const [doc, setDoc] = useState<EntityRecord | null>(null);
  const [header, setHeader] = useState<Record<string, unknown>>({ currencyCode: "USD" });
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [payments, setPayments] = useState<EntityRecord[]>([]);
  const [actions, setActions] = useState<TransitionOption[]>([]);
  const [busy, setBusy] = useState(false);
  // bill payment form
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank");

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
    if (res.payments) setPayments(res.payments);
    const tr = await apiFetch<{ actions: TransitionOption[] }>(`/entities/${entity.name}/${id}/transitions`);
    setActions(tr.actions);
  }

  useEffect(() => {
    if (isNew) return;
    load().catch((e) => toast.error((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const currency = String(header.currencyCode ?? "USD");
  function setField(name: string, value: unknown) {
    setHeader((h) => ({ ...h, [name]: value }));
  }
  function flatHeader() {
    const out: Record<string, unknown> = {
      supplierId: header.supplierId ?? null,
      currencyCode: currency,
      notes: header.notes ?? null,
    };
    if (mode === "po") out.warehouseId = header.warehouseId ?? null;
    if (mode === "bill") out.goodsReceiptId = header.goodsReceiptId ?? null;
    for (const d of dateFields) out[d.name] = header[d.name] ?? null;
    return out;
  }

  async function save() {
    if (!header.supplierId) {
      toast.error("Please choose a supplier");
      return;
    }
    if (mode === "po" && !header.warehouseId) {
      toast.error("Please choose a warehouse");
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
      // Vendor-bill "receive" posts to the GL, so it goes through the bespoke
      // endpoint rather than the plain status transition.
      if (mode === "bill" && action === "receive") {
        await apiFetch(`${apiBase}/${id}/receive`, { method: "POST" });
      } else {
        await apiFetch(`/entities/${entity.name}/${id}/transitions`, { method: "POST", body: { action } });
      }
      toast.success(action);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addPayment() {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`${apiBase}/${id}/payments`, {
        method: "POST",
        body: { amount, method: payMethod, paidAt: new Date().toISOString().slice(0, 10) },
      });
      setPayAmount("");
      toast.success("Payment recorded");
      await load();
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
          <Button variant="primary" size="sm" loading={busy} onClick={save}>
            Save
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader title="Details" />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="supplier" required>
              Supplier
            </Label>
            <Select id="supplier" value={String(header.supplierId ?? "")} onChange={(e) => setField("supplierId", e.target.value || null)}>
              <option value="">— Select —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {String(s.name)}
                </option>
              ))}
            </Select>
          </div>

          {mode === "po" && (
            <div>
              <Label htmlFor="warehouse" required>
                Warehouse
              </Label>
              <Select id="warehouse" value={String(header.warehouseId ?? "")} onChange={(e) => setField("warehouseId", e.target.value || null)}>
                <option value="">— Select —</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {String(w.name)}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {mode === "bill" && (
            <div>
              <Label htmlFor="grn">Goods Receipt (optional)</Label>
              <Select id="grn" value={String(header.goodsReceiptId ?? "")} onChange={(e) => setField("goodsReceiptId", e.target.value || null)}>
                <option value="">— None —</option>
                {goodsReceipts.map((g) => (
                  <option key={g.id} value={g.id}>
                    {String(g.number)}
                  </option>
                ))}
              </Select>
            </div>
          )}

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
              <Input id={d.name} type="date" value={String(header[d.name] ?? "")} onChange={(e) => setField(d.name, e.target.value || null)} />
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
          <LineItemsEditor lines={lines} products={products} currencyCode={currency} priceSource="costPrice" onChange={setLines} />
        </CardBody>
      </Card>

      {mode === "bill" && !isNew && doc && (
        <Card>
          <CardHeader title="Payments" />
          <CardBody className="space-y-3">
            {payments.length > 0 && (
              <table className="w-full text-sm">
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="py-1.5">{String(p.number ?? "")}</td>
                      <td className="py-1.5">{String(p.method ?? "")}</td>
                      <td className="py-1.5">{p.paidAt ? new Date(String(p.paidAt)).toLocaleDateString() : ""}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatMoney(Number(p.amount ?? 0), currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex items-end gap-2">
              <div>
                <Label htmlFor="pa">Amount</Label>
                <Input id="pa" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-32" />
              </div>
              <div>
                <Label htmlFor="pm">Method</Label>
                <Select id="pm" value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-32">
                  <option value="bank">Bank</option>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <Button size="sm" onClick={addPayment} disabled={busy}>
                Record payment
              </Button>
              <div className="ml-auto text-right text-sm">
                <div className="text-muted">Balance</div>
                <div className="font-semibold tabular-nums">{formatMoney(Number(doc.balance ?? 0), currency)}</div>
              </div>
            </div>
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
