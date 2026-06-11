"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select, Label } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { formatMoney } from "@/lib/finance/money";
import { docTotals, lineTotals } from "@/lib/finance/totals";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils/cn";
import { resolveProduct, useBarcodeScanner, playBeep, newIdempotencyKey } from "@/lib/pos/scanner";
import { ScannerChip } from "@/components/crm/scanner-chip";
import type { EntityRecord } from "@/lib/metadata/types";

interface CartLine {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
}

export function PosTerminal() {
  const t = useT();
  const [branches, setBranches] = useState<EntityRecord[]>([]);
  const [warehouses, setWarehouses] = useState<EntityRecord[]>([]);
  const [dealers, setDealers] = useState<EntityRecord[]>([]);
  const [products, setProducts] = useState<EntityRecord[]>([]);
  const [session, setSession] = useState<EntityRecord | null>(null);

  const [branchId, setBranchId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [dealerId, setDealerId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [scan, setScan] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [payMethod, setPayMethod] = useState("cash");
  const [tendered, setTendered] = useState("");
  const [openingFloat, setOpeningFloat] = useState("");
  const [busy, setBusy] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  // Idempotency token for the current sale: a double-submit (or a retry after a
  // lost response) reuses it so the server never rings up two invoices. Reset
  // after a confirmed sale so the next checkout starts a fresh token.
  const idemRef = useRef<string>("");
  // Keep a live ref of products so the global scanner always resolves against
  // the latest list without re-subscribing the window listener.
  const productsRef = useRef<EntityRecord[]>([]);
  productsRef.current = products;

  const payMethods = useMemo(
    () => [
      { value: "cash", label: t("pos.pay.cash") },
      { value: "card", label: t("pos.pay.card") },
      { value: "other", label: t("pos.pay.other") },
    ],
    [t],
  );

  useEffect(() => {
    (async () => {
      try {
        const [br, wh, dl, pr, ses] = await Promise.all([
          apiFetch<{ items: EntityRecord[] }>("/entities/branch?pageSize=200"),
          apiFetch<{ items: EntityRecord[] }>("/entities/warehouse?pageSize=200"),
          apiFetch<{ items: EntityRecord[] }>("/entities/dealer?pageSize=200"),
          apiFetch<{ items: EntityRecord[] }>("/entities/product?pageSize=500&filter.active=true"),
          apiFetch<{ session: EntityRecord | null }>("/pos/session"),
        ]);
        setBranches(br.items);
        setWarehouses(wh.items);
        setDealers(dl.items);
        setProducts(pr.items);
        if (ses.session) {
          setSession(ses.session);
          setBranchId(String(ses.session.branchId ?? ""));
          setWarehouseId(String(ses.session.warehouseId ?? ""));
        } else if (br.items[0]) {
          setBranchId(String(br.items[0].id));
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    })().catch(() => {});
  }, []);

  // Clear the just-added line highlight shortly after it appears.
  useEffect(() => {
    if (!flashId) return;
    const tmr = setTimeout(() => setFlashId(null), 700);
    return () => clearTimeout(tmr);
  }, [flashId]);

  const warehouseOptions = useMemo(
    () => (branchId ? warehouses.filter((w) => String(w.branchId ?? "") === branchId) : warehouses),
    [warehouses, branchId],
  );

  const totals = useMemo(() => docTotals(cart.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate }))), [cart]);
  const itemCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);
  const change = Math.max(0, Math.round((Number(tendered || 0) - totals.total) * 100) / 100);
  const money = (n: number) => formatMoney(n, currencyCode);

  const filtered = useMemo(() => {
    const q = scan.trim().toLowerCase();
    if (!q) return [] as EntityRecord[];
    return products.filter((p) => `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(q)).slice(0, 8);
  }, [products, scan]);

  function addProduct(p: EntityRecord) {
    const id = String(p.id);
    setCart((c) => {
      const existing = c.find((l) => l.productId === id);
      if (existing) return c.map((l) => (l.productId === id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { productId: id, name: String(p.name ?? p.sku ?? ""), qty: 1, unitPrice: Number(p.unitPrice ?? 0), taxRate: Number(p.taxRate ?? 0) }];
    });
    setCurrencyCode((c) => (cart.length === 0 ? String(p.currencyCode ?? c) : c));
    setFlashId(id);
  }

  /** A confirmed hardware scan: resolve exactly (no fuzzy fallback) and add. */
  async function handleScanned(code: string) {
    const p = await resolveProduct(productsRef.current, code);
    if (p) {
      addProduct(p);
      playBeep(true);
    } else {
      playBeep(false);
      toast.error(t("scan.notFound", { code }));
    }
    setScan("");
    scanRef.current?.focus();
  }

  useBarcodeScanner({ onScan: (code) => void handleScanned(code) });

  /** Manual Enter in the scan/find box: exact code, else the top search match. */
  async function addByCode() {
    const code = scan.trim();
    if (!code) return;
    const p = await resolveProduct(products, code);
    if (p) {
      addProduct(p);
      playBeep(true);
    } else if (filtered.length > 0) {
      addProduct(filtered[0]);
    } else {
      playBeep(false);
      toast.error(t("scan.notFound", { code }));
    }
    setScan("");
    scanRef.current?.focus();
  }

  function setQty(id: string, qty: number) {
    setCart((c) => (qty <= 0 ? c.filter((l) => l.productId !== id) : c.map((l) => (l.productId === id ? { ...l, qty } : l))));
  }

  async function openShift() {
    setBusy(true);
    try {
      const { session: s } = await apiFetch<{ session: EntityRecord }>("/pos/session/open", {
        method: "POST",
        body: { branchId: branchId || null, warehouseId: warehouseId || null, openingFloat: Number(openingFloat || 0) },
      });
      setSession(s);
      toast.success(t("pos.shiftOpened", { number: String(s.number) }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function closeShift() {
    if (!session) return;
    const counted = window.prompt(t("pos.countPrompt"), String(session.expectedCash ?? 0));
    if (counted === null) return;
    setBusy(true);
    try {
      const { session: s } = await apiFetch<{ session: EntityRecord }>("/pos/session/close", {
        method: "POST",
        body: { sessionId: session.id, countedCash: Number(counted || 0) },
      });
      toast.success(t("pos.shiftClosed", { variance: money(Number(s.variance ?? 0)) }));
      setSession(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (!cart.length) {
      toast.error(t("pos.cartEmpty"));
      return;
    }
    setBusy(true);
    if (!idemRef.current) idemRef.current = newIdempotencyKey();
    try {
      const res = await apiFetch<{ invoice: EntityRecord; total: number; paid: number; change: number }>("/pos/checkout", {
        method: "POST",
        headers: { "Idempotency-Key": idemRef.current },
        body: {
          branchId: branchId || null,
          warehouseId: warehouseId || null,
          dealerId: dealerId || null,
          sessionId: session?.id ?? null,
          currencyCode,
          lines: cart.map((l) => ({ productId: l.productId, description: l.name, qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate })),
          payments: Number(tendered) > 0 ? [{ method: payMethod, amount: Number(tendered) }] : [{ method: payMethod, amount: totals.total }],
        },
      });
      idemRef.current = ""; // confirmed sale → next checkout uses a fresh token
      toast.success(t("pos.saleDone", { number: String(res.invoice.number), change: money(res.change) }));
      if (session) {
        try {
          const { session: s } = await apiFetch<{ session: EntityRecord | null }>("/pos/session");
          if (s) setSession(s);
        } catch {
          /* ignore — running totals are cosmetic */
        }
      }
      window.open(`/pos/receipt/${res.invoice.id}`, "_blank");
      setCart([]);
      setTendered("");
      scanRef.current?.focus();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const quickCash = useMemo(() => {
    const t0 = totals.total;
    return [t0, Math.ceil(t0 / 10) * 10, Math.ceil(t0 / 50) * 50, Math.ceil(t0 / 100) * 100]
      .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
      .slice(0, 4);
  }, [totals.total]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{t("pos.title")}</h1>
          <p className="text-xs text-muted">{t("pos.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {session ? (
            <>
              <span className="rounded-md bg-surface-2 px-2 py-1 text-xs">
                {t("pos.shift")} <strong>{String(session.number)}</strong> · {money(Number(session.salesTotal ?? 0))}
              </span>
              <Button size="sm" variant="ghost" onClick={closeShift} disabled={busy}>
                {t("pos.closeShift")}
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <Input placeholder={t("pos.openingFloat")} type="number" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} className="h-8 w-32 text-xs" />
              <Button size="sm" onClick={openShift} disabled={busy}>
                {t("pos.openShift")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* setup: where the sale books to + who it's for */}
      <Card>
        <CardBody className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <Label htmlFor="b">{t("pos.branch")}</Label>
            <Select id="b" value={branchId} onChange={(e) => { setBranchId(e.target.value); setWarehouseId(""); }} disabled={!!session}>
              <option value="">—</option>
              {branches.map((b) => (
                <option key={String(b.id)} value={String(b.id)}>{String(b.name)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="w">{t("pos.warehouse")}</Label>
            <Select id="w" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={!!session}>
              <option value="">—</option>
              {warehouseOptions.map((w) => (
                <option key={String(w.id)} value={String(w.id)}>{String(w.name)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="d">{t("pos.customer")}</Label>
            <Select id="d" value={dealerId} onChange={(e) => setDealerId(e.target.value)}>
              <option value="">{t("pos.walkin")}</option>
              {dealers.map((d) => (
                <option key={String(d.id)} value={String(d.id)}>{String(d.name)}</option>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* left: scan + cart */}
        <div className="space-y-4">
          <Card>
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
                  value={scan}
                  onChange={(e) => setScan(e.target.value)}
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
              {filtered.length > 0 && (
                <div className="max-h-64 space-y-1 overflow-auto pr-1">
                  {filtered.map((p) => {
                    const meta = [String(p.sku ?? ""), p.barcode ? String(p.barcode) : ""].filter(Boolean).join(" · ");
                    return (
                      <button
                        key={String(p.id)}
                        type="button"
                        onClick={() => { addProduct(p); setScan(""); scanRef.current?.focus(); }}
                        className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
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
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={`${t("pos.cart")} · ${itemCount}`} />
            <CardBody>
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="py-2">{t("pos.item")}</th>
                    <th className="w-32 py-2">{t("pos.qty")}</th>
                    <th className="w-24 py-2 text-right">{t("pos.price")}</th>
                    <th className="w-24 py-2 text-right">{t("pos.total")}</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {cart.map((l) => (
                    <tr key={l.productId} className={cn("border-b border-border transition-colors last:border-0", flashId === l.productId && "bg-primary/5")}>
                      <td className="py-2 font-medium text-foreground">{l.name}</td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-1">
                          <button className="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-surface-2" onClick={() => setQty(l.productId, l.qty - 1)} aria-label="−">−</button>
                          <Input type="number" value={l.qty} onChange={(e) => setQty(l.productId, Number(e.target.value))} className="h-7 w-12 text-center text-xs" />
                          <button className="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-surface-2" onClick={() => setQty(l.productId, l.qty + 1)} aria-label="+">+</button>
                        </div>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{money(l.unitPrice)}</td>
                      <td className="py-1.5 text-right tabular-nums font-medium">{money(lineTotals(l).lineTotal)}</td>
                      <td className="py-1.5">
                        <button onClick={() => setQty(l.productId, 0)} className="text-muted hover:text-danger" aria-label={t("cart.remove")}>
                          <Icon name="trash" className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cart.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-xs text-muted">
                        <Icon name="scan" className="mx-auto mb-2 h-7 w-7 text-muted-2" />
                        {t("pos.empty")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </div>

        {/* right: payment */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader title={t("pos.payment")} />
          <CardBody className="space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted">{t("pos.subtotal")}</span><span className="tabular-nums">{money(totals.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted">{t("pos.tax")}</span><span className="tabular-nums">{money(totals.taxTotal)}</span></div>
              <div className="flex justify-between border-t border-border pt-1 text-xl font-semibold"><span>{t("pos.total")}</span><span className="tabular-nums">{money(totals.total)}</span></div>
            </div>

            <div>
              <Label htmlFor="pm">{t("pos.method")}</Label>
              <Select id="pm" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                {payMethods.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="tn">{t("pos.tendered")}</Label>
              <Input id="tn" type="number" placeholder={String(totals.total)} value={tendered} onChange={(e) => setTendered(e.target.value)} />
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {quickCash.map((v) => (
                <button key={v} onClick={() => setTendered(String(v))} className="rounded-md border border-border py-1 text-xs tabular-nums hover:bg-surface-2">
                  {money(v)}
                </button>
              ))}
            </div>
            <div className="flex justify-between rounded-md bg-surface-2 px-3 py-2 text-sm">
              <span className="text-muted">{t("pos.change")}</span>
              <span className="tabular-nums font-semibold">{money(change)}</span>
            </div>

            <Button variant="primary" className="w-full" loading={busy} disabled={cart.length === 0} onClick={checkout}>
              <Icon name="cart" className="h-4 w-4" /> {t("pos.charge")} · {money(totals.total)}
            </Button>
            {cart.length > 0 && (
              <button type="button" onClick={() => { setCart([]); setTendered(""); scanRef.current?.focus(); }} className="w-full text-xs text-muted hover:text-foreground">
                {t("cart.clear")}
              </button>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
