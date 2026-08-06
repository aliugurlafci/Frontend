"use client";

/**
 * Register queue (Kasa Kuyruğu) — the cash desk's side of the cart.
 *
 * Baskets sent from the shop floor land here with a short pickup code. The
 * cashier types the code (or picks the cart from the list), optionally adjusts
 * the basket, then closes it: tender it, leave the balance on the customer's
 * account, park it, or reject it. Every button shown is one the server already
 * told us this session may run (`actions`), so the UI can never offer an action
 * the permission matrix withholds.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { useT, useLocale } from "@/lib/i18n/client";
import { fmtDateTime } from "@/lib/i18n/format";
import { formatMoney } from "@/lib/finance/money";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select, Label } from "@/components/ui/input";
import { Badge, type Tone } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";
import { resolveProduct, useBarcodeScanner, playBeep, newIdempotencyKey } from "@/lib/pos/scanner";
import { buildProductIndex, searchProductIndex } from "@/lib/pos/product-search";
import type { EntityRecord } from "@/lib/metadata/types";

interface QueueLine {
  productId: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
}

interface CartDetail {
  doc: EntityRecord;
  lines: EntityRecord[];
  actions?: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
/** How often the queue refreshes itself, so a newly sent basket shows up. */
const POLL_MS = 15_000;

const STATUS_TONE: Record<string, Tone> = { sent: "warning", suspended: "neutral" };

function toLine(l: EntityRecord): QueueLine {
  return {
    productId: l.productId ? String(l.productId) : null,
    description: String(l.description ?? ""),
    qty: Number(l.qty ?? 0),
    unitPrice: Number(l.unitPrice ?? 0),
    taxRate: Number(l.taxRate ?? 0),
  };
}

export function RegisterQueue({
  products,
  accounts,
  canEdit,
}: {
  products: EntityRecord[];
  accounts: EntityRecord[];
  /** `cart:update` — may this cashier change a queued basket's contents? */
  canEdit: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const [codeQuery, setCodeQuery] = useState("");
  const [items, setItems] = useState<EntityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CartDetail | null>(null);
  const [lines, setLines] = useState<QueueLine[]>([]);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [tendered, setTendered] = useState("");
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  // One idempotency token per open basket, so a double-click (or a retried
  // request) can never ring the same cart up twice.
  const idemRef = useRef<string>("");

  const payMethods = useMemo(
    () => [
      { value: "cash", label: t("pos.pay.cash") },
      { value: "card", label: t("pos.pay.card") },
      { value: "other", label: t("pos.pay.other") },
    ],
    [t],
  );

  const accountName = useCallback(
    (id: unknown) => {
      const found = accounts.find((a) => String(a.id) === String(id ?? ""));
      return found ? String(found.name ?? "") : "";
    },
    [accounts],
  );

  const load = useCallback(async (code?: string) => {
    setLoading(true);
    try {
      const digits = (code ?? "").replace(/\D/g, "");
      const qs = `status=sent,suspended${digits ? `&code=${digits}` : ""}`;
      const res = await apiFetch<{ items: EntityRecord[] }>(`/carts?${qs}`);
      setItems(res.items);
      return res.items;
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setItems([]);
      else toast.error(e instanceof ApiRequestError ? e.message : t("common.somethingWrong"));
      return [];
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the queue fresh without stealing focus or discarding pending edits.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!dirty && !busy) void load(codeQuery);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load, codeQuery, dirty, busy]);

  const openCart = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        const res = await apiFetch<CartDetail>(`/carts/${id}`);
        setSelectedId(id);
        setDetail(res);
        setLines(res.lines.map(toLine));
        setDirty(false);
        setTendered("");
        idemRef.current = newIdempotencyKey();
      } catch (e) {
        toast.error(e instanceof ApiRequestError ? e.message : t("common.somethingWrong"));
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  /** Enter in the code box: jump straight into the matching basket. */
  async function findByCode() {
    const digits = codeQuery.replace(/\D/g, "");
    if (!digits) {
      await load();
      return;
    }
    const found = await load(digits);
    if (found.length === 1) await openCart(String(found[0].id));
    else if (found.length === 0) toast.error(t("queue.notFound", { code: digits }));
  }

  const currency = String(detail?.doc.currencyCode ?? "USD");
  const money = (n: number) => formatMoney(n, currency);

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

  const change = Math.max(0, round2(Number(tendered || 0) - totals.total));
  const actions = detail?.actions ?? [];
  const can = (action: string) => actions.includes(action);

  // ---- basket edits (cashier-side) ----
  function mutate(next: QueueLine[]) {
    setLines(next);
    setDirty(true);
  }
  function setQty(i: number, qty: number) {
    const next = [...lines];
    next[i] = { ...next[i], qty: Math.max(0, Math.floor(qty) || 0) };
    mutate(next.filter((l) => l.qty > 0));
  }
  function setPrice(i: number, unitPrice: number) {
    const next = [...lines];
    next[i] = { ...next[i], unitPrice: Math.max(0, unitPrice || 0) };
    mutate(next);
  }
  function removeLine(i: number) {
    mutate(lines.filter((_, idx) => idx !== i));
  }
  function addProduct(p: EntityRecord) {
    const id = String(p.id);
    const idx = lines.findIndex((l) => l.productId === id);
    if (idx >= 0) {
      const next = [...lines];
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
      mutate(next);
      return;
    }
    mutate([
      ...lines,
      {
        productId: id,
        description: String(p.name ?? p.sku ?? ""),
        qty: 1,
        unitPrice: Number(p.unitPrice ?? 0),
        taxRate: Number(p.taxRate ?? 0),
      },
    ]);
  }

  async function addByCode(code: string) {
    const p = await resolveProduct(products, code);
    if (p) {
      addProduct(p);
      playBeep(true);
    } else {
      playBeep(false);
      toast.error(t("cart.notFound", { code }));
    }
    setSearch("");
  }

  // A hardware scan adds to the open basket; with none open it looks up a code.
  useBarcodeScanner({
    onScan: (code) => {
      if (detail && canEdit) void addByCode(code);
      else {
        setCodeQuery(code.replace(/\D/g, ""));
        void load(code);
      }
    },
  });

  // Search text prepared once per catalogue, so a keystroke only scans it.
  const productIndex = useMemo(() => buildProductIndex(products), [products]);
  const productMatches = useMemo(
    () => searchProductIndex(productIndex, search, { limit: 8, whenEmpty: "none" }),
    [productIndex, search],
  );

  /** Persist cashier edits before any closing action. */
  async function persistEdits(id: string): Promise<void> {
    if (!dirty) return;
    await apiFetch(`/carts/${id}`, { method: "PUT", body: { header: {}, lines } });
    setDirty(false);
  }

  async function runAction(action: "suspend" | "resume" | "cancel") {
    if (!selectedId) return;
    setBusy(true);
    try {
      await apiFetch(`/carts/${selectedId}/${action}`, { method: "POST", body: {} });
      toast.success(t(`queue.done.${action}`));
      setDetail(null);
      setSelectedId(null);
      await load(codeQuery);
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function close(settlement: "paid" | "credit") {
    if (!selectedId || lines.length === 0) return;
    setBusy(true);
    if (!idemRef.current) idemRef.current = newIdempotencyKey();
    try {
      await persistEdits(selectedId);
      const amount = settlement === "paid" ? Number(tendered || 0) || totals.total : 0;
      const res = await apiFetch<{ invoice: EntityRecord; change: number }>(`/carts/${selectedId}/checkout`, {
        method: "POST",
        headers: { "Idempotency-Key": idemRef.current },
        body: {
          settlement,
          payments: settlement === "paid" ? [{ method: payMethod, amount }] : [],
        },
      });
      idemRef.current = "";
      toast.success(
        settlement === "credit"
          ? t("queue.done.credit")
          : t("queue.done.paid", { change: money(Number(res.change ?? 0)) }),
      );
      setDetail(null);
      setSelectedId(null);
      setTendered("");
      await load(codeQuery);
      const invId = res.invoice?.id;
      if (invId) router.push(`/invoice/${invId}`);
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  const quickCash = useMemo(() => {
    const total = totals.total;
    if (total <= 0) return [] as number[];
    const steps = [total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100];
    return [...new Set(steps.map((v) => round2(v)))].slice(0, 4);
  }, [totals.total]);

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      {/* Queue list + code lookup */}
      <Card className="h-fit">
        <CardHeader title={t("queue.title")} />
        <CardBody className="space-y-2">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <input
              ref={codeRef}
              autoFocus
              inputMode="numeric"
              value={codeQuery}
              onChange={(e) => setCodeQuery(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void findByCode();
                }
              }}
              placeholder={t("queue.codePlaceholder")}
              aria-label={t("queue.codePlaceholder")}
              className="h-11 w-full rounded-lg border border-border-strong bg-surface/60 pl-9 pr-3 text-base tabular-nums text-foreground placeholder:text-muted-2 focus:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
          <div className="flex items-center justify-between px-0.5">
            <p className="text-[11px] text-muted-2">{t("queue.codeHint")}</p>
            <button
              type="button"
              onClick={() => {
                setCodeQuery("");
                void load();
              }}
              className="text-[11px] text-muted hover:text-foreground"
            >
              {t("queue.refresh")}
            </button>
          </div>

          <div className="max-h-[30rem] space-y-1.5 overflow-auto pr-1">
            {items.length === 0 && !loading && (
              <p className="px-1 py-6 text-center text-xs text-muted">{t("queue.empty")}</p>
            )}
            {items.map((c) => {
              const status = String(c.status ?? "sent");
              const active = String(c.id) === selectedId;
              return (
                <button
                  key={String(c.id)}
                  type="button"
                  onClick={() => void openCart(String(c.id))}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors",
                    active ? "border-primary/60 bg-primary/5" : "border-border hover:border-border-strong hover:bg-surface-2",
                  )}
                >
                  <span className="min-w-10 shrink-0 text-center text-lg font-semibold tabular-nums text-primary">
                    {Number(c.code ?? 0) || "—"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {String(c.createdByName ?? "") || String(c.number ?? "")}
                    </span>
                    <span className="block truncate text-[11px] text-muted">
                      {c.sentAt ? fmtDateTime(locale, String(c.sentAt)) : String(c.number ?? "")}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums text-foreground">
                      {formatMoney(Number(c.total ?? 0), String(c.currencyCode ?? "USD"))}
                    </span>
                    <Badge tone={STATUS_TONE[status] ?? "info"}>{t(`queue.status.${status}`)}</Badge>
                  </span>
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Selected basket */}
      {!detail ? (
        <Card>
          <CardBody>
            <EmptyState icon="cart" title={t("queue.pickTitle")} description={t("queue.pickDesc")} />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={`${t("queue.cartNo")} ${Number(detail.doc.code ?? 0) || "—"}`}
              action={<Badge tone={STATUS_TONE[String(detail.doc.status ?? "sent")] ?? "info"}>{t(`queue.status.${String(detail.doc.status ?? "sent")}`)}</Badge>}
            />
            <CardBody className="space-y-3">
              <div className="grid gap-2 text-xs sm:grid-cols-4">
                <Meta label={t("queue.createdBy")} value={String(detail.doc.createdByName ?? "—")} />
                <Meta label={t("queue.sentAt")} value={detail.doc.sentAt ? fmtDateTime(locale, String(detail.doc.sentAt)) : "—"} />
                <Meta label={t("cart.customer")} value={accountName(detail.doc.accountId) || t("cart.walkIn")} />
                <Meta label={t("queue.docNo")} value={String(detail.doc.number ?? "—")} />
              </div>

              {canEdit && (
                <div className="space-y-1.5 border-t border-border pt-3">
                  <div className="relative">
                    <Icon name="scan" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        if (productMatches.length) {
                          addProduct(productMatches[0]);
                          setSearch("");
                        } else if (search.trim()) {
                          void addByCode(search.trim());
                        }
                      }}
                      placeholder={t("queue.addItem")}
                      aria-label={t("queue.addItem")}
                      className="h-10 w-full rounded-lg border border-border-strong bg-surface/60 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-2 focus:outline-none focus-visible:border-ring"
                    />
                  </div>
                  {productMatches.length > 0 && (
                    <div className="space-y-1 rounded-md border border-border p-1">
                      {productMatches.map((p) => (
                        <button
                          key={String(p.id)}
                          type="button"
                          onClick={() => {
                            addProduct(p);
                            setSearch("");
                          }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-surface-2"
                        >
                          <span className="min-w-0 flex-1 truncate text-foreground">{String(p.name ?? "")}</span>
                          <span className="shrink-0 tabular-nums text-muted">
                            {formatMoney(Number(p.unitPrice ?? 0), String(p.currencyCode ?? currency))}
                          </span>
                          <Icon name="plus" className="h-3.5 w-3.5 shrink-0 text-primary" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                {lines.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">{t("cart.emptyAdd")}</p>
                ) : (
                  lines.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{l.description || "—"}</div>
                        {canEdit ? (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={l.unitPrice}
                            onChange={(e) => setPrice(i, Number(e.target.value))}
                            aria-label={t("queue.unitPrice")}
                            className="mt-0.5 h-6 w-24 rounded border border-border-strong bg-surface/60 px-1 text-xs text-foreground focus:outline-none focus-visible:border-ring"
                          />
                        ) : (
                          <div className="text-xs tabular-nums text-muted">{money(l.unitPrice)}</div>
                        )}
                      </div>
                      {canEdit ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" onClick={() => setQty(i, l.qty - 1)} aria-label="−" className="flex h-7 w-7 items-center justify-center rounded border border-border text-sm hover:bg-surface-2">−</button>
                          <input
                            type="number"
                            min={0}
                            value={l.qty}
                            onChange={(e) => setQty(i, Number(e.target.value))}
                            aria-label={t("queue.qty")}
                            className="h-7 w-12 rounded border border-border-strong bg-surface/60 text-center text-xs text-foreground focus:outline-none focus-visible:border-ring"
                          />
                          <button type="button" onClick={() => setQty(i, l.qty + 1)} aria-label="+" className="flex h-7 w-7 items-center justify-center rounded border border-border text-sm hover:bg-surface-2">+</button>
                        </div>
                      ) : (
                        <span className="shrink-0 text-sm tabular-nums text-muted">×{l.qty}</span>
                      )}
                      <span className="w-20 shrink-0 text-right text-sm tabular-nums text-foreground">{money(round2(l.qty * l.unitPrice))}</span>
                      {canEdit && (
                        <button type="button" onClick={() => removeLine(i)} aria-label={t("cart.remove")} className="shrink-0 text-muted-2 hover:text-danger">
                          <Icon name="trash" className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-1 border-t border-border pt-2 text-sm">
                <div className="flex items-center justify-between text-muted">
                  <span>{t("cart.subtotal")}</span>
                  <span className="tabular-nums text-foreground">{money(totals.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-muted">
                  <span>{t("cart.tax")}</span>
                  <span className="tabular-nums text-foreground">{money(totals.tax)}</span>
                </div>
                <div className="flex items-center justify-between pt-1 text-base font-semibold">
                  <span>{t("cart.total")}</span>
                  <span className="tabular-nums">{money(totals.total)}</span>
                </div>
                {dirty && <p className="text-[11px] text-warning">{t("queue.unsaved")}</p>}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("queue.settle")} />
            <CardBody className="space-y-3">
              {can("checkout") && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="q-pm">{t("pos.method")}</Label>
                    <Select id="q-pm" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      {payMethods.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="q-tn">{t("pos.tendered")}</Label>
                    <Input id="q-tn" type="number" placeholder={String(totals.total)} value={tendered} onChange={(e) => setTendered(e.target.value)} />
                  </div>
                </div>
              )}
              {can("checkout") && quickCash.length > 0 && (
                <div className="grid grid-cols-4 gap-1.5">
                  {quickCash.map((v) => (
                    <button key={v} type="button" onClick={() => setTendered(String(v))} className="rounded-md border border-border py-1 text-xs tabular-nums hover:bg-surface-2">
                      {money(v)}
                    </button>
                  ))}
                </div>
              )}
              {can("checkout") && (
                <div className="flex justify-between rounded-md bg-surface-2 px-3 py-2 text-sm">
                  <span className="text-muted">{t("pos.change")}</span>
                  <span className="font-semibold tabular-nums">{money(change)}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {can("checkout") && (
                  <Button variant="primary" size="sm" loading={busy} disabled={lines.length === 0} onClick={() => void close("paid")} className="flex-1">
                    <Icon name="payment" className="h-3.5 w-3.5" /> {t("queue.takePayment")} · {money(totals.total)}
                  </Button>
                )}
                {can("credit") && (
                  <Button variant="secondary" size="sm" disabled={busy || lines.length === 0} onClick={() => void close("credit")}>
                    <Icon name="receipt" className="h-3.5 w-3.5" /> {t("queue.closeOnAccount")}
                  </Button>
                )}
                {can("suspend") && (
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => void runAction("suspend")}>
                    <Icon name="pause" className="h-3.5 w-3.5" /> {t("queue.suspend")}
                  </Button>
                )}
                {can("resume") && (
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => void runAction("resume")}>
                    <Icon name="play" className="h-3.5 w-3.5" /> {t("queue.resume")}
                  </Button>
                )}
                {can("cancel") && (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => void runAction("cancel")}>
                    <Icon name="close" className="h-3.5 w-3.5" /> {t("queue.cancel")}
                  </Button>
                )}
              </div>
              {actions.length === 0 && <p className="text-xs text-muted">{t("queue.noActions")}</p>}
              {canEdit && dirty && (
                <Button variant="secondary" size="xs" disabled={busy} onClick={() => void persistEdits(selectedId!).then(() => toast.success(t("cart.saved")))}>
                  <Icon name="file" className="h-3.5 w-3.5" /> {t("queue.saveChanges")}
                </Button>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-2">{label}</div>
      <div className="truncate text-xs font-medium text-foreground">{value}</div>
    </div>
  );
}
