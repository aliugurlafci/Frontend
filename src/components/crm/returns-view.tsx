"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { formatMoney } from "@/lib/finance/money";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { resolveProduct, useBarcodeScanner, playBeep, newIdempotencyKey } from "@/lib/pos/scanner";
import { ScannerChip } from "@/components/crm/scanner-chip";
import type { EntityRecord } from "@/lib/metadata/types";

interface ReturnLine {
  productId: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const STATUS_TONE: Record<string, "neutral" | "success" | "danger"> = { draft: "neutral", posted: "success", void: "danger" };

export function ReturnsView({
  products,
  accounts,
  warehouses,
  branches,
  initialReturns,
}: {
  products: EntityRecord[];
  accounts: EntityRecord[];
  warehouses: EntityRecord[];
  branches: EntityRecord[];
  initialReturns: EntityRecord[];
}) {
  const t = useT();
  const router = useRouter();
  const [returns, setReturns] = useState<EntityRecord[]>(initialReturns);
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [accountId, setAccountId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [reason, setReason] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  // Idempotency token for the current return (reset after a confirmed submit) so
  // a double-submit can't create two returns / double-restock.
  const idemRef = useRef<string>("");
  // The product just added — briefly highlights its line as scan feedback.
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    if (!flashId) return;
    const tmr = setTimeout(() => setFlashId(null), 700);
    return () => clearTimeout(tmr);
  }, [flashId]);

  const accName = useMemo(() => new Map(accounts.map((a) => [String(a.id), String(a.name ?? "")])), [accounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(q));
  }, [products, search]);

  function addProduct(p: EntityRecord) {
    const id = String(p.id);
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [
        ...prev,
        { productId: id, description: String(p.name ?? p.sku ?? ""), qty: 1, unitPrice: Number(p.unitPrice ?? 0), taxRate: Number(p.taxRate ?? 0) },
      ];
    });
    setCurrencyCode((c) => (lines.length === 0 ? String(p.currencyCode ?? c) : c));
    setFlashId(id);
  }

  /** Manual Enter in the scan/search box: exact code, else the top search match. */
  async function addByCode() {
    const code = search.trim();
    if (!code) return;
    const p = await resolveProduct(products, code);
    if (p) {
      addProduct(p);
      playBeep(true);
    } else if (filtered.length > 0) {
      addProduct(filtered[0]);
    } else {
      playBeep(false);
      toast.error(t("cart.notFound", { code }));
    }
    setSearch("");
    scanRef.current?.focus();
  }

  /** A confirmed hardware scan from anywhere on the screen — resolve exactly and add. */
  async function handleScanned(code: string) {
    const p = await resolveProduct(products, code);
    if (p) {
      addProduct(p);
      playBeep(true);
    } else {
      playBeep(false);
      toast.error(t("cart.notFound", { code }));
    }
    setSearch("");
    scanRef.current?.focus();
  }

  useBarcodeScanner({ onScan: (code) => void handleScanned(code) });
  function setQty(i: number, qty: number) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, qty: Math.max(0, Math.floor(qty) || 0) } : l)).filter((l) => l.qty > 0));
  }
  function setPrice(i: number, unitPrice: number) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, unitPrice: Math.max(0, unitPrice || 0) } : l)));
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = useMemo(
    () => round2(lines.reduce((s, l) => s + l.qty * l.unitPrice * (1 + l.taxRate / 100), 0)),
    [lines],
  );

  function reset() {
    setLines([]);
    setAccountId("");
    setBranchId("");
    setReason("");
  }

  async function refreshList() {
    try {
      const res = await apiFetch<{ items: EntityRecord[] }>("/sales-returns");
      setReturns(res.items);
    } catch {
      /* ignore */
    }
  }

  async function create(post: boolean) {
    if (!lines.length) {
      toast.error(t("ret.needLines"));
      return;
    }
    if (post && !warehouseId) {
      toast.error(t("ret.needWarehouse"));
      return;
    }
    setBusy(true);
    if (!idemRef.current) idemRef.current = newIdempotencyKey();
    try {
      const res = await apiFetch<{ doc: EntityRecord }>("/sales-returns", {
        method: "POST",
        headers: { "Idempotency-Key": idemRef.current },
        body: {
          accountId: accountId || null,
          warehouseId: warehouseId || null,
          branchId: branchId || null,
          currencyCode,
          reason: reason || null,
          lines,
        },
      });
      idemRef.current = ""; // confirmed → fresh token for the next return
      const id = String(res.doc.id);
      if (post) {
        await apiFetch(`/sales-returns/${id}/post`, { method: "POST", body: {} });
        toast.success(t("ret.posted"));
      } else {
        toast.success(t("ret.created"));
      }
      reset();
      await refreshList();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function postExisting(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/sales-returns/${id}/post`, { method: "POST", body: {} });
      toast.success(t("ret.posted"));
      await refreshList();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  const money = (n: number) => formatMoney(n, currencyCode);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{t("ret.title")}</h1>
        <p className="text-xs text-muted">{t("ret.subtitle")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Products */}
        <Card>
          <CardHeader title={t("ret.products")} />
          <CardBody className="space-y-2">
            <div className="flex items-center justify-between">
              <ScannerChip />
              <span className="text-[11px] text-muted-2">{t("scan.activeHint")}</span>
            </div>
            <div className="relative">
              <Icon name="scan" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
              <input
                ref={scanRef}
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addByCode();
                  }
                }}
                placeholder={t("scan.placeholder")}
                aria-label={t("scan.placeholder")}
                className="h-12 w-full rounded-lg border border-border-strong bg-surface/60 pl-10 pr-3 text-base text-foreground transition-colors placeholder:text-muted-2 focus:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </div>
            <div className="max-h-80 space-y-1 overflow-auto pr-1">
              {filtered.length === 0 && <p className="px-1 py-3 text-xs text-muted">{t("common.noResults")}</p>}
              {filtered.map((p) => {
                const meta = [String(p.sku ?? ""), p.barcode ? String(p.barcode) : ""].filter(Boolean).join(" · ");
                return (
                  <button
                    key={String(p.id)}
                    type="button"
                    onClick={() => addProduct(p)}
                    className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left transition-colors hover:bg-surface-2 hover:border-border-strong"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{String(p.name ?? "") || "—"}</div>
                      {meta && <div className="truncate text-xs text-muted">{meta}</div>}
                    </div>
                    <Icon name="plus" className="h-4 w-4 shrink-0 text-primary" />
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* Return form */}
        <div className="space-y-4">
          <Card>
            <CardHeader title={t("ret.new")} />
            <CardBody className="space-y-3">
              {lines.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">{t("cart.emptyAdd")}</p>
              ) : (
                <div className="space-y-1.5">
                  {lines.map((l, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-2 py-1.5 transition-all duration-300",
                        flashId && l.productId === flashId ? "border-primary/60 bg-primary/5 ring-1 ring-primary/40" : "border-border",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{l.description || "—"}</div>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.unitPrice}
                          onChange={(e) => setPrice(i, Number(e.target.value))}
                          className="mt-0.5 h-6 w-24 rounded border border-border-strong bg-surface/60 px-1 text-xs text-foreground focus:outline-none focus-visible:border-ring"
                        />
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => setQty(i, l.qty - 1)} aria-label="−" className="flex h-7 w-7 items-center justify-center rounded border border-border text-sm hover:bg-surface-2">−</button>
                        <input
                          type="number"
                          min={0}
                          value={l.qty}
                          onChange={(e) => setQty(i, Number(e.target.value))}
                          className="h-7 w-12 rounded border border-border-strong bg-surface/60 text-center text-xs text-foreground focus:outline-none focus-visible:border-ring"
                        />
                        <button type="button" onClick={() => setQty(i, l.qty + 1)} aria-label="+" className="flex h-7 w-7 items-center justify-center rounded border border-border text-sm hover:bg-surface-2">+</button>
                      </div>
                      <button type="button" onClick={() => removeLine(i)} aria-label={t("cart.remove")} className="shrink-0 text-muted-2 hover:text-danger">
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
                    <span>{t("cart.total")}</span>
                    <span className="tabular-nums">{money(total)}</span>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="ret-acc">{t("ret.customer")}</Label>
                <Select id="ret-acc" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">{t("cart.none")}</option>
                  {accounts.map((a) => (
                    <option key={String(a.id)} value={String(a.id)}>{String(a.name ?? "")}</option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="ret-wh">{t("ret.warehouse")}</Label>
                  <Select id="ret-wh" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                    <option value="">{t("cart.none")}</option>
                    {warehouses.map((w) => (
                      <option key={String(w.id)} value={String(w.id)}>{String(w.name ?? w.code ?? "")}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ret-branch">{t("ret.branch")}</Label>
                  <Select id="ret-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                    <option value="">{t("cart.none")}</option>
                    {branches.map((b) => (
                      <option key={String(b.id)} value={String(b.id)}>{String(b.name ?? b.code ?? "")}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="ret-reason">{t("ret.reason")}</Label>
                <Input id="ret-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="secondary" size="sm" disabled={busy || lines.length === 0} onClick={() => create(false)}>
                  {t("ret.create")}
                </Button>
                <Button variant="primary" size="sm" loading={busy} disabled={lines.length === 0} onClick={() => create(true)} className="flex-1">
                  <Icon name="return" className="h-3.5 w-3.5" /> {t("ret.createPost")}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Recent returns */}
      <Card className="overflow-hidden">
        <CardHeader title={t("ret.recent")} />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-2">
              <th className="px-4 py-2.5">{t("ret.colNumber")}</th>
              <th className="px-4 py-2.5">{t("ret.colCustomer")}</th>
              <th className="px-4 py-2.5">{t("ret.colTotal")}</th>
              <th className="px-4 py-2.5">{t("ret.colStatus")}</th>
              <th className="px-4 py-2.5 text-right">{t("ret.colActions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {returns.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">{t("ret.none")}</td>
              </tr>
            ) : (
              returns.map((r) => {
                const status = String(r.status ?? "draft");
                return (
                  <tr key={String(r.id)} className="hover:bg-surface-2">
                    <td className="px-4 py-3 font-medium text-foreground">{String(r.number ?? r.id)}</td>
                    <td className="px-4 py-3 text-muted">{accName.get(String(r.accountId)) ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{formatMoney(Number(r.total ?? 0), String(r.currencyCode ?? "USD"))}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[status] ?? "neutral"}>{t(`ret.st.${status}`)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {status === "draft" && (
                        <Button variant="ghost" size="xs" disabled={busy} onClick={() => postExisting(String(r.id))}>
                          <Icon name="return" className="h-3.5 w-3.5" /> {t("ret.post")}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
