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
import { Select, Label } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { resolveProduct, useBarcodeScanner, playBeep } from "@/lib/pos/scanner";
import { ScannerChip } from "@/components/crm/scanner-chip";
import type { EntityRecord } from "@/lib/metadata/types";

interface CartLine {
  productId: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function CartView({
  products,
  accounts,
  warehouses,
  branches,
}: {
  products: EntityRecord[];
  accounts: EntityRecord[];
  warehouses: EntityRecord[];
  branches: EntityRecord[];
}) {
  const t = useT();
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [accountId, setAccountId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [cartId, setCartId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedCarts, setSavedCarts] = useState<EntityRecord[]>([]);
  const scanRef = useRef<HTMLInputElement>(null);
  // The product just added — briefly highlights its basket line as scan feedback.
  const [flashId, setFlashId] = useState<string | null>(null);

  async function loadSaved() {
    try {
      const res = await apiFetch<{ items: EntityRecord[] }>("/carts");
      setSavedCarts(res.items);
    } catch {
      /* ignore — no read access */
    }
  }
  useEffect(() => {
    loadSaved().catch(() => {});
  }, []);

  // Clear the "just added" highlight shortly after it appears.
  useEffect(() => {
    if (!flashId) return;
    const tmr = setTimeout(() => setFlashId(null), 800);
    return () => clearTimeout(tmr);
  }, [flashId]);

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
        {
          productId: id,
          description: String(p.name ?? p.sku ?? ""),
          qty: 1,
          unitPrice: Number(p.unitPrice ?? 0),
          taxRate: Number(p.taxRate ?? 0),
        },
      ];
    });
    setCurrencyCode((c) => (lines.length === 0 ? String(p.currencyCode ?? c) : c));
    setFlashId(String(p.id));
  }

  /**
   * Manual Enter in the scan/search box: exact barcode/SKU first (instant, also
   * via the POS lookup for products beyond the preloaded list), then fall back
   * to the top name/SKU/barcode search match.
   */
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

  /**
   * A confirmed hardware scan from anywhere on the screen — resolve exactly (no
   * fuzzy fallback, a scanner emits precise codes) and add, with audible feedback.
   */
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
    setLines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], qty: Math.max(0, Math.floor(qty) || 0) };
      return next.filter((l) => l.qty > 0);
    });
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function setPrice(i: number, unitPrice: number) {
    setLines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], unitPrice: Math.max(0, unitPrice || 0) };
      return next;
    });
  }

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const l of lines) {
      const base = l.qty * l.unitPrice;
      subtotal += base;
      tax += (base * l.taxRate) / 100;
    }
    return { subtotal: round2(subtotal), tax: round2(tax), total: round2(subtotal + tax) };
  }, [lines]);

  function reset() {
    setLines([]);
    setAccountId("");
    setBranchId("");
    setWarehouseId("");
    setCartId(null);
  }

  function payload() {
    return {
      accountId: accountId || null,
      branchId: branchId || null,
      warehouseId: warehouseId || null,
      currencyCode,
      lines,
    };
  }

  /** Persist the basket as an open cart (create or update); returns its id. */
  async function persist(): Promise<string> {
    if (cartId) {
      await apiFetch(`/carts/${cartId}`, { method: "PUT", body: { header: payload(), lines } });
      return cartId;
    }
    const res = await apiFetch<{ doc: EntityRecord }>("/carts", { method: "POST", body: payload() });
    const id = String(res.doc.id);
    setCartId(id);
    return id;
  }

  async function saveDraft() {
    if (!lines.length) return;
    setBusy(true);
    try {
      await persist();
      toast.success(t("cart.saved"));
      await loadSaved();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (!lines.length) return;
    setBusy(true);
    try {
      const id = await persist();
      const res = await apiFetch<{ invoice: EntityRecord }>(`/carts/${id}/checkout`, { method: "POST", body: {} });
      toast.success(t("cart.checkoutDone"));
      reset();
      await loadSaved();
      const invId = res.invoice?.id;
      if (invId) router.push(`/invoice/${invId}`);
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function resume(id: string) {
    setBusy(true);
    try {
      const res = await apiFetch<{ doc: EntityRecord; lines: EntityRecord[] }>(`/carts/${id}`);
      setCartId(id);
      setAccountId(String(res.doc.accountId ?? ""));
      setBranchId(String(res.doc.branchId ?? ""));
      setWarehouseId(String(res.doc.warehouseId ?? ""));
      setCurrencyCode(String(res.doc.currencyCode ?? "USD"));
      setLines(
        res.lines.map((l) => ({
          productId: l.productId ? String(l.productId) : null,
          description: String(l.description ?? ""),
          qty: Number(l.qty ?? 0),
          unitPrice: Number(l.unitPrice ?? 0),
          taxRate: Number(l.taxRate ?? 0),
        })),
      );
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function discard(id: string) {
    try {
      await apiFetch(`/carts/${id}`, { method: "DELETE" });
      if (cartId === id) reset();
      await loadSaved();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : t("common.somethingWrong"));
    }
  }

  const money = (n: number) => formatMoney(n, currencyCode);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{t("cart.title")}</h1>
          <p className="text-xs text-muted">{t("cart.subtitle")}</p>
        </div>
        {savedCarts.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{t("cart.savedCarts")}</span>
            <div className="flex flex-wrap gap-1">
              {savedCarts.map((c) => (
                <span key={String(c.id)} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs">
                  <button type="button" onClick={() => resume(String(c.id))} className="font-medium text-foreground hover:text-primary">
                    {String(c.number ?? c.id)}
                  </button>
                  <button type="button" onClick={() => discard(String(c.id))} aria-label={t("cart.remove")} className="text-muted-2 hover:text-danger">
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Product picker */}
        <Card>
          <CardHeader title={t("cart.products")} />
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
                placeholder={t("cart.scan")}
                aria-label={t("cart.scan")}
                className="h-12 w-full rounded-lg border border-border-strong bg-surface/60 pl-10 pr-3 text-base text-foreground transition-colors placeholder:text-muted-2 focus:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </div>
            <p className="px-0.5 text-[11px] text-muted-2">{t("cart.scanHint")}</p>
            <div className="max-h-[26rem] space-y-1 overflow-auto pr-1">
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
                    <span className="shrink-0 text-sm tabular-nums text-muted">{formatMoney(Number(p.unitPrice ?? 0), String(p.currencyCode ?? currencyCode))}</span>
                    <Icon name="plus" className="h-4 w-4 shrink-0 text-primary" />
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* Basket */}
        <div className="space-y-4">
          <Card>
            <CardHeader title={t("cart.basket")} />
            <CardBody className="space-y-3">
              {lines.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">{t("cart.emptyAdd")}</p>
              ) : (
                <div className="space-y-1.5">
                  {lines.map((l, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-2 py-1.5 transition-all duration-300",
                        flashId && l.productId === flashId
                          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/40"
                          : "border-border",
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
                      <span className="w-20 shrink-0 text-right text-sm tabular-nums text-foreground">{money(round2(l.qty * l.unitPrice))}</span>
                      <button type="button" onClick={() => removeLine(i)} aria-label={t("cart.remove")} className="shrink-0 text-muted-2 hover:text-danger">
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1 border-t border-border pt-2 text-sm">
                <Row label={t("cart.subtotal")} value={money(totals.subtotal)} />
                <Row label={t("cart.tax")} value={money(totals.tax)} />
                <div className="flex items-center justify-between pt-1 text-base font-semibold">
                  <span>{t("cart.total")}</span>
                  <span className="tabular-nums">{money(totals.total)}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("cart.customer")} />
            <CardBody className="space-y-3">
              <div>
                <Label htmlFor="cart-acc">{t("cart.customer")}</Label>
                <Select id="cart-acc" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">{t("cart.walkIn")}</option>
                  {accounts.map((a) => (
                    <option key={String(a.id)} value={String(a.id)}>{String(a.name ?? "")}</option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="cart-branch">{t("cart.branch")}</Label>
                  <Select id="cart-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                    <option value="">{t("cart.none")}</option>
                    {branches.map((b) => (
                      <option key={String(b.id)} value={String(b.id)}>{String(b.name ?? b.code ?? "")}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="cart-wh">{t("cart.warehouse")}</Label>
                  <Select id="cart-wh" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                    <option value="">{t("cart.none")}</option>
                    {warehouses.map((w) => (
                      <option key={String(w.id)} value={String(w.id)}>{String(w.name ?? w.code ?? "")}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="secondary" size="sm" disabled={busy || lines.length === 0} onClick={saveDraft}>
                  <Icon name="file" className="h-3.5 w-3.5" /> {t("cart.save")}
                </Button>
                <Button variant="primary" size="sm" loading={busy} disabled={lines.length === 0} onClick={checkout} className="flex-1">
                  <Icon name="cart" className="h-3.5 w-3.5" /> {t("cart.checkout")} {totals.total > 0 ? `· ${money(totals.total)}` : ""}
                </Button>
              </div>
              {lines.length > 0 && (
                <button type="button" onClick={reset} className="text-xs text-muted hover:text-foreground">
                  {t("cart.clear")}
                </button>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted">
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}
