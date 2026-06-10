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
import { useT } from "@/lib/i18n/client";

interface GrnLine {
  productId: string;
  description: string;
  qty: number;
  unitCost: number;
  outstanding: number; // remaining qty on the PO line (max receivable)
}
interface DocResult {
  doc: EntityRecord;
  lines: EntityRecord[];
}

/**
 * Goods-receipt editor — receipts are always made against an APPROVED purchase
 * order. Selecting a PO pulls in its outstanding lines (you can only receive the
 * PO's own products, up to each line's remaining quantity). There is no free-form
 * receiving: without an approved PO there is nothing to receive.
 */
export function GoodsReceiptEditor({
  id,
  products,
  purchaseOrders,
}: {
  id: string;
  suppliers: EntityRecord[];
  products: EntityRecord[];
  warehouses: EntityRecord[];
  purchaseOrders: EntityRecord[];
}) {
  const router = useRouter();
  const t = useT();
  const isNew = id === "new";
  const [doc, setDoc] = useState<EntityRecord | null>(null);
  const [poId, setPoId] = useState<string>("");
  const [po, setPo] = useState<EntityRecord | null>(null);
  const [receiptDate, setReceiptDate] = useState<string>("");
  const [lines, setLines] = useState<GrnLine[]>([]);
  const [busy, setBusy] = useState(false);

  const posted = doc?.status === "posted" || doc?.status === "void";
  const productName = (pid: string) => products.find((p) => String(p.id) === pid)?.name as string | undefined;

  async function load() {
    const res = await apiFetch<DocResult>(`/goods-receipts/${id}`);
    setDoc(res.doc);
    setPoId(String(res.doc.poId ?? ""));
    setReceiptDate(String(res.doc.receiptDate ?? ""));
    setLines(
      res.lines.map((l) => ({
        productId: String(l.productId ?? ""),
        description: String(productName(String(l.productId ?? "")) ?? l.description ?? ""),
        qty: typeof l.qty === "number" ? l.qty : 0,
        unitCost: typeof l.unitCost === "number" ? l.unitCost : 0,
        outstanding: typeof l.qty === "number" ? l.qty : 0,
      })),
    );
  }

  useEffect(() => {
    if (isNew) return;
    load().catch((e) => toast.error((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /** Pull the chosen PO's outstanding lines into the receipt. */
  async function pickPO(nextPoId: string) {
    setPoId(nextPoId);
    setPo(null);
    setLines([]);
    if (!nextPoId) return;
    try {
      const res = await apiFetch<DocResult>(`/purchase-orders/${nextPoId}`);
      setPo(res.doc);
      const outstandingLines = res.lines
        .map((l) => {
          const outstanding = Number(l.qty ?? 0) - Number(l.qtyReceived ?? 0);
          return {
            productId: String(l.productId ?? ""),
            description: String(l.description ?? productName(String(l.productId ?? "")) ?? ""),
            qty: outstanding,
            unitCost: Number(l.unitPrice ?? 0),
            outstanding,
          } as GrnLine;
        })
        .filter((l) => l.productId && l.outstanding > 0);
      if (!outstandingLines.length) toast.message(t("grn.nothingOutstanding"));
      setLines(outstandingLines);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function updateLine(i: number, patch: Partial<GrnLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const total = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);

  async function create() {
    if (!poId) {
      toast.error(t("grn.poRequired"));
      return;
    }
    const validLines = lines.filter((l) => l.productId && l.qty > 0);
    if (!validLines.length) {
      toast.error(t("grn.addLine"));
      return;
    }
    const over = validLines.find((l) => l.qty > l.outstanding + 1e-9);
    if (over) {
      toast.error(t("grn.overReceive", { product: over.description }));
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<DocResult>("/goods-receipts", {
        method: "POST",
        body: {
          poId,
          warehouseId: po?.warehouseId ?? null,
          supplierId: po?.supplierId ?? null,
          receiptDate: receiptDate || null,
          lines: validLines.map((l) => ({ productId: l.productId, qty: l.qty, unitCost: l.unitCost })),
        },
      });
      toast.success(t("grn.created"));
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
      toast.success(t("grn.posted"));
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
            <Icon name="chevronLeft" className="inline h-4 w-4" /> {t("grn.listTitle")}
          </Link>
          <h1 className="text-lg font-semibold">{isNew ? t("grn.new") : String(doc?.number ?? "GRN")}</h1>
          {doc && <Badge tone={doc.status === "posted" ? "success" : doc.status === "void" ? "danger" : "neutral"}>{String(doc.status)}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {isNew ? (
            <Button variant="primary" size="sm" loading={busy} onClick={create}>
              {t("grn.create")}
            </Button>
          ) : (
            doc?.status === "draft" && (
              <Button variant="primary" size="sm" loading={busy} onClick={post}>
                {t("grn.post")}
              </Button>
            )
          )}
        </div>
      </div>

      {isNew && (
        <p className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-sm text-foreground">{t("grn.hint")}</p>
      )}

      <Card>
        <CardHeader title={t("grn.details")} />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="po" required>
              {t("grn.purchaseOrder")}
            </Label>
            {isNew ? (
              <Select id="po" value={poId} onChange={(e) => pickPO(e.target.value)}>
                <option value="">{t("grn.selectApprovedPO")}</option>
                {purchaseOrders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {String(p.number)}
                  </option>
                ))}
              </Select>
            ) : (
              <Input value={purchaseOrders.find((p) => String(p.id) === poId)?.number as string ?? poId} disabled />
            )}
          </div>
          <div>
            <Label htmlFor="rd">{t("grn.receiptDate")}</Label>
            <Input id="rd" type="date" disabled={!isNew} value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("grn.receivedItems")} />
        <CardBody>
          {lines.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">{isNew ? t("grn.pickPOFirst") : t("grn.noLines")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted">
                <tr>
                  <th className="py-2">{t("grn.colProduct")}</th>
                  {isNew && <th className="w-20 py-2 text-right">{t("grn.colOrdered")}</th>}
                  <th className="w-24 py-2">{t("grn.colQty")}</th>
                  <th className="w-28 py-2">{t("grn.colUnitCost")}</th>
                  <th className="w-28 py-2 text-right">{t("grn.colTotal")}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-1.5">{l.description || productName(l.productId) || l.productId}</td>
                    {isNew && <td className="py-1.5 text-right tabular-nums text-muted">{l.outstanding}</td>}
                    <td className="py-1.5">
                      {posted || !isNew ? (
                        l.qty
                      ) : (
                        <Input
                          type="number"
                          value={l.qty}
                          min={0}
                          max={l.outstanding}
                          onChange={(e) => updateLine(i, { qty: Math.min(Number(e.target.value), l.outstanding) })}
                          className="h-8 text-xs"
                        />
                      )}
                    </td>
                    <td className="py-1.5">
                      {posted || !isNew ? (
                        formatMoney(l.unitCost, "USD")
                      ) : (
                        <Input type="number" value={l.unitCost} onChange={(e) => updateLine(i, { unitCost: Number(e.target.value) })} className="h-8 text-xs" />
                      )}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{formatMoney(l.qty * l.unitCost, "USD")}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border">
                <tr>
                  <td colSpan={isNew ? 3 : 2} className="py-2 text-right text-xs text-muted">
                    {t("grn.totalValue")}
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums">{formatMoney(total, "USD")}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
