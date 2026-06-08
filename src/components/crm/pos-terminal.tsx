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
import type { EntityRecord } from "@/lib/metadata/types";

interface CartLine {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
}

const PAY_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

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
  const [payMethod, setPayMethod] = useState("cash");
  const [tendered, setTendered] = useState("");
  const [openingFloat, setOpeningFloat] = useState("");
  const [busy, setBusy] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

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
        } else {
          if (br.items[0]) setBranchId(String(br.items[0].id));
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    })().catch(() => {});
  }, []);

  const warehouseOptions = useMemo(
    () => (branchId ? warehouses.filter((w) => String(w.branchId ?? "") === branchId) : warehouses),
    [warehouses, branchId],
  );

  const totals = useMemo(() => docTotals(cart.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate }))), [cart]);
  const currency = "USD";
  const change = Math.max(0, Math.round((Number(tendered || 0) - totals.total) * 100) / 100);

  function addProduct(p: EntityRecord) {
    const id = String(p.id);
    setCart((c) => {
      const existing = c.find((l) => l.productId === id);
      if (existing) return c.map((l) => (l.productId === id ? { ...l, qty: l.qty + 1 } : l));
      return [
        ...c,
        {
          productId: id,
          name: String(p.name ?? ""),
          qty: 1,
          unitPrice: Number(p.unitPrice ?? 0),
          taxRate: Number(p.taxRate ?? 0),
        },
      ];
    });
  }

  async function onScan(e: React.FormEvent) {
    e.preventDefault();
    const code = scan.trim();
    if (!code) return;
    setScan("");
    // try local match first (instant), else hit the lookup endpoint
    const local = products.find((p) => String(p.barcode ?? "") === code || String(p.sku ?? "") === code);
    if (local) {
      addProduct(local);
      scanRef.current?.focus();
      return;
    }
    try {
      const { product } = await apiFetch<{ product: EntityRecord }>(`/pos/lookup?code=${encodeURIComponent(code)}`);
      addProduct(product);
    } catch (e) {
      toast.error(e instanceof ApiRequestError && e.status === 404 ? `No product for "${code}"` : (e as Error).message);
    }
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
      toast.success(`Shift ${String(s.number)} opened`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function closeShift() {
    if (!session) return;
    const counted = prompt(t("pos.countPrompt"), String(session.expectedCash ?? 0));
    if (counted === null) return;
    setBusy(true);
    try {
      const { session: s } = await apiFetch<{ session: EntityRecord }>("/pos/session/close", {
        method: "POST",
        body: { sessionId: session.id, countedCash: Number(counted || 0) },
      });
      toast.success(`Shift closed · variance ${formatMoney(Number(s.variance ?? 0), currency)}`);
      setSession(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (!cart.length) {
      toast.error("Cart is empty");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<{ invoice: EntityRecord; total: number; paid: number; change: number }>("/pos/checkout", {
        method: "POST",
        body: {
          branchId: branchId || null,
          warehouseId: warehouseId || null,
          dealerId: dealerId || null,
          sessionId: session?.id ?? null,
          lines: cart.map((l) => ({ productId: l.productId, description: l.name, qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate })),
          payments: Number(tendered) > 0 ? [{ method: payMethod, amount: Number(tendered) }] : [{ method: payMethod, amount: totals.total }],
        },
      });
      toast.success(`Sale ${String(res.invoice.number)} · change ${formatMoney(res.change, currency)}`);
      // refresh running session totals
      if (session) {
        try {
          const { session: s } = await apiFetch<{ session: EntityRecord | null }>("/pos/session");
          if (s) setSession(s);
        } catch {
          /* ignore */
        }
      }
      window.open(`/pos/receipt/${res.invoice.id}`, "_blank");
      setCart([]);
      setTendered("");
      scanRef.current?.focus();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
                Shift <strong>{String(session.number)}</strong> · {formatMoney(Number(session.salesTotal ?? 0), currency)}
              </span>
              <Button size="sm" variant="ghost" onClick={closeShift} disabled={busy}>
                {t("pos.closeShift")}
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <Input
                placeholder={t("pos.openingFloat")}
                type="number"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                className="h-8 w-32 text-xs"
              />
              <Button size="sm" onClick={openShift} disabled={busy}>
                {t("pos.openShift")}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* left: scan + cart */}
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="b">{t("pos.branch")}</Label>
                  <Select id="b" value={branchId} onChange={(e) => { setBranchId(e.target.value); setWarehouseId(""); }} disabled={!!session}>
                    <option value="">—</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{String(b.name)}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="w">{t("pos.warehouse")}</Label>
                  <Select id="w" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={!!session}>
                    <option value="">—</option>
                    {warehouseOptions.map((w) => (
                      <option key={w.id} value={w.id}>{String(w.name)}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="d">{t("pos.customer")}</Label>
                  <Select id="d" value={dealerId} onChange={(e) => setDealerId(e.target.value)}>
                    <option value="">{t("pos.walkin")}</option>
                    {dealers.map((d) => (
                      <option key={d.id} value={d.id}>{String(d.name)}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <form onSubmit={onScan} className="flex gap-2">
                <div className="relative flex-1">
                  <Icon name="scan" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    ref={scanRef}
                    autoFocus
                    placeholder={t("pos.scan")}
                    value={scan}
                    onChange={(e) => setScan(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border-strong bg-surface/60 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-2 focus:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                  />
                </div>
                <Select
                  value=""
                  onChange={(e) => {
                    const p = products.find((x) => String(x.id) === e.target.value);
                    if (p) addProduct(p);
                  }}
                  className="w-44"
                >
                  <option value="">{t("pos.addProduct")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{String(p.name)}</option>
                  ))}
                </Select>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={`${t("pos.cart")} (${cart.length})`} />
            <CardBody>
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="py-2">{t("pos.item")}</th>
                    <th className="w-28 py-2">{t("pos.qty")}</th>
                    <th className="w-24 py-2 text-right">{t("pos.price")}</th>
                    <th className="w-24 py-2 text-right">{t("pos.total")}</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {cart.map((l) => (
                    <tr key={l.productId} className="border-b border-border last:border-0">
                      <td className="py-2">{l.name}</td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-1">
                          <button className="rounded border border-border px-1.5" onClick={() => setQty(l.productId, l.qty - 1)}>−</button>
                          <Input type="number" value={l.qty} onChange={(e) => setQty(l.productId, Number(e.target.value))} className="h-7 w-12 text-center text-xs" />
                          <button className="rounded border border-border px-1.5" onClick={() => setQty(l.productId, l.qty + 1)}>+</button>
                        </div>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{formatMoney(l.unitPrice, currency)}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatMoney(lineTotals(l).lineTotal, currency)}</td>
                      <td className="py-1.5">
                        <button onClick={() => setQty(l.productId, 0)} className="text-muted hover:text-danger" aria-label="Remove">
                          <Icon name="trash" className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cart.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-muted">{t("pos.empty")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </div>

        {/* right: payment */}
        <Card>
          <CardHeader title={t("pos.payment")} />
          <CardBody className="space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted">{t("pos.subtotal")}</span><span className="tabular-nums">{formatMoney(totals.subtotal, currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted">{t("pos.tax")}</span><span className="tabular-nums">{formatMoney(totals.taxTotal, currency)}</span></div>
              <div className="flex justify-between border-t border-border pt-1 text-lg font-semibold"><span>{t("pos.total")}</span><span className="tabular-nums">{formatMoney(totals.total, currency)}</span></div>
            </div>

            <div>
              <Label htmlFor="pm">{t("pos.method")}</Label>
              <Select id="pm" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                {PAY_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="tn">{t("pos.tendered")}</Label>
              <Input id="tn" type="number" placeholder={String(totals.total)} value={tendered} onChange={(e) => setTendered(e.target.value)} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">{t("pos.change")}</span>
              <span className="tabular-nums font-semibold">{formatMoney(change, currency)}</span>
            </div>

            <Button variant="primary" className="w-full" loading={busy} disabled={cart.length === 0} onClick={checkout}>
              <Icon name="cart" className="h-4 w-4" /> {t("pos.charge")} {formatMoney(totals.total, currency)}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              {[totals.total, Math.ceil(totals.total / 10) * 10, Math.ceil(totals.total / 50) * 50, Math.ceil(totals.total / 100) * 100]
                .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
                .slice(0, 4)
                .map((v) => (
                  <button key={v} onClick={() => setTendered(String(v))} className="rounded-md border border-border py-1 text-xs hover:bg-surface-2">
                    {formatMoney(v, currency)}
                  </button>
                ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
