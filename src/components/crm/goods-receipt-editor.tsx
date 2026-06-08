"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { EntityRecord } from "@/lib/metadata/types";
import { apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/finance/money";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";

interface GrnLine {
  productId: string | null;
  qty: number;
  unitCost: number;
}
interface DocResult {
  doc: EntityRecord;
  lines: EntityRecord[];
}

const emptyLine = (): GrnLine => ({ productId: null, qty: 1, unitCost: 0 });

/** Goods-receipt editor: compose receipt lines, create, then post (writes stock
 *  movements + GL). Posted receipts are read-only. */
export function GoodsReceiptEditor({
  id,
  suppliers,
  products,
  warehouses,
  purchaseOrders,
}: {
  id: string;
  suppliers: EntityRecord[];
  products: EntityRecord[];
  warehouses: EntityRecord[];
  purchaseOrders: EntityRecord[];
}) {
  const router = useRouter();
  const isNew = id === "new";
  const [doc, setDoc] = useState<EntityRecord | null>(null);
  const [header, setHeader] = useState<Record<string, unknown>>({});
  const [lines, setLines] = useState<GrnLine[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);

  const posted = doc?.status === "posted" || doc?.status === "void";

  async function load() {
    const res = await apiFetch<DocResult>(`/goods-receipts/${id}`);
    setDoc(res.doc);
    setHeader({ ...res.doc });
    setLines(
      res.lines.map((l) => ({
        productId: (l.productId as string) ?? null,
        qty: typeof l.qty === "number" ? l.qty : 0,
        unitCost: typeof l.unitCost === "number" ? l.unitCost : 0,
      })),
    );
  }

  useEffect(() => {
    if (isNew) return;
    load().catch((e) => toast.error((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function setField(name: string, value: unknown) {
    setHeader((h) => ({ ...h, [name]: value }));
  }
  function updateLine(i: number, patch: Partial<GrnLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function pickProduct(i: number, productId: string) {
    const p = products.find((x) => String(x.id) === productId);
    updateLine(i, { productId: productId || null, unitCost: p && typeof p.costPrice === "number" ? p.costPrice : 0 });
  }

  const total = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);

  async function create() {
    if (!header.warehouseId) {
      toast.error("Please choose a warehouse");
      return;
    }
    const validLines = lines.filter((l) => l.productId && l.qty > 0);
    if (!validLines.length) {
      toast.error("Add at least one line");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<DocResult>("/goods-receipts", {
        method: "POST",
        body: {
          warehouseId: header.warehouseId,
          supplierId: header.supplierId ?? null,
          poId: header.poId ?? null,
          receiptDate: header.receiptDate ?? null,
          lines: validLines.map((l) => ({ productId: l.productId, qty: l.qty, unitCost: l.unitCost })),
        },
      });
      toast.success("Goods receipt created");
      router.push(`/goodsReceipt/${res.doc.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function post() {
    setBusy(true);
    try {
      await apiFetch(`/goods-receipts/${id}/post`, { method: "POST" });
      toast.success("Posted — stock updated");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/goodsReceipt" className="text-sm text-muted hover:text-foreground">
            <Icon name="chevronLeft" className="inline h-4 w-4" /> Goods Receipts
          </Link>
          <h1 className="text-lg font-semibold">{isNew ? "New Goods Receipt" : String(doc?.number ?? "GRN")}</h1>
          {doc && <Badge tone={doc.status === "posted" ? "success" : doc.status === "void" ? "danger" : "neutral"}>{String(doc.status)}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {isNew ? (
            <Button variant="primary" size="sm" loading={busy} onClick={create}>
              Create
            </Button>
          ) : (
            doc?.status === "draft" && (
              <Button variant="primary" size="sm" loading={busy} onClick={post}>
                Post receipt
              </Button>
            )
          )}
        </div>
      </div>

      <Card>
        <CardHeader title="Details" />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="wh" required>
              Warehouse
            </Label>
            <Select id="wh" value={String(header.warehouseId ?? "")} disabled={!isNew} onChange={(e) => setField("warehouseId", e.target.value || null)}>
              <option value="">— Select —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {String(w.name)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="sup">Supplier</Label>
            <Select id="sup" value={String(header.supplierId ?? "")} disabled={!isNew} onChange={(e) => setField("supplierId", e.target.value || null)}>
              <option value="">— None —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {String(s.name)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="po">Purchase Order</Label>
            <Select id="po" value={String(header.poId ?? "")} disabled={!isNew} onChange={(e) => setField("poId", e.target.value || null)}>
              <option value="">— None —</option>
              {purchaseOrders.map((p) => (
                <option key={p.id} value={p.id}>
                  {String(p.number)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="rd">Receipt Date</Label>
            <Input id="rd" type="date" disabled={!isNew} value={String(header.receiptDate ?? "")} onChange={(e) => setField("receiptDate", e.target.value || null)} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Received items" />
        <CardBody>
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-2">Product</th>
                <th className="w-24 py-2">Qty</th>
                <th className="w-28 py-2">Unit Cost</th>
                <th className="w-28 py-2 text-right">Total</th>
                {!posted && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-1.5">
                    {posted ? (
                      products.find((p) => String(p.id) === l.productId)?.name as string ?? l.productId
                    ) : (
                      <Select value={l.productId ?? ""} onChange={(e) => pickProduct(i, e.target.value)} className="h-8 text-xs">
                        <option value="">— Select —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {String(p.name)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </td>
                  <td className="py-1.5">
                    {posted ? l.qty : <Input type="number" value={l.qty} onChange={(e) => updateLine(i, { qty: Number(e.target.value) })} className="h-8 text-xs" />}
                  </td>
                  <td className="py-1.5">
                    {posted ? formatMoney(l.unitCost, "USD") : <Input type="number" value={l.unitCost} onChange={(e) => updateLine(i, { unitCost: Number(e.target.value) })} className="h-8 text-xs" />}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(l.qty * l.unitCost, "USD")}</td>
                  {!posted && (
                    <td className="py-1.5">
                      <button onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="text-muted hover:text-danger" aria-label="Remove">
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border">
              <tr>
                <td colSpan={3} className="py-2 text-right text-xs text-muted">
                  Total value
                </td>
                <td className="py-2 text-right font-semibold tabular-nums">{formatMoney(total, "USD")}</td>
                {!posted && <td />}
              </tr>
            </tfoot>
          </table>
          {!posted && (
            <Button size="sm" className="mt-2" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
              <Icon name="plus" className="h-3.5 w-3.5" /> Add line
            </Button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
