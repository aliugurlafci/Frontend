import { serverApi } from "@/lib/http/server-api";
import type { AggregateRow } from "@/lib/data/query";
import type { EntityRecord } from "@/lib/metadata/types";
import { getLocale } from "@/lib/i18n/server";
import { t as translate } from "@/lib/i18n/messages";
import { fmtMoney, fmtNumber, fmtDate, fmtDateTime } from "@/lib/i18n/format";
import { ReportHeader, ReportKpis, ReportSections } from "@/components/crm/report-shell";
import type { ReportPayload, ReportSection } from "@/lib/reports/types";

export const dynamic = "force-dynamic";

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

type AggParams = Parameters<typeof serverApi.aggregate>[1];
async function safeAgg(entity: string, params: AggParams): Promise<AggregateRow[]> {
  try {
    return await serverApi.aggregate(entity, params);
  } catch {
    return [];
  }
}
async function safeList(entity: string, pageSize: number): Promise<EntityRecord[]> {
  try {
    return (await serverApi.list(entity, { pageSize })).items;
  } catch {
    return [];
  }
}

/**
 * Goods Receipt & Inventory report — goods received from suppliers (by supplier,
 * warehouse, product + a recent-receipts detail) and the resulting stock position
 * (on-hand by product/branch + low-stock alerts). Goods-receipt figures come from
 * the posted stock-receipt movements (`refType = goodsReceipt`), inventory from the
 * net of all stock movements. Exports to Excel/PDF like the other reports.
 */
export default async function GoodsReceiptReportPage() {
  const locale = await getLocale();
  const tr = (k: string, vars?: Record<string, string>) => translate(locale, k, vars);
  const now = new Date().toISOString();

  const [recvByProduct, recvByWarehouse, recvByRef, invByProduct, invByBranch, grnList, products, suppliers, warehouses, branches] =
    await Promise.all([
      safeAgg("stockMovement", {
        groupBy: "productId",
        filters: [{ field: "refType", op: "eq", value: "goodsReceipt" }],
        measures: [{ op: "sum", field: "qty", as: "qty" }, { op: "sum", field: "value", as: "value" }],
      }),
      safeAgg("stockMovement", {
        groupBy: "warehouseId",
        filters: [{ field: "refType", op: "eq", value: "goodsReceipt" }],
        measures: [{ op: "sum", field: "qty", as: "qty" }, { op: "sum", field: "value", as: "value" }],
      }),
      safeAgg("stockMovement", {
        groupBy: "ref",
        filters: [{ field: "refType", op: "eq", value: "goodsReceipt" }],
        measures: [{ op: "sum", field: "qty", as: "qty" }, { op: "sum", field: "value", as: "value" }],
      }),
      safeAgg("stockMovement", { groupBy: "productId", measures: [{ op: "sum", field: "qty", as: "qty" }, { op: "sum", field: "value", as: "value" }] }),
      safeAgg("stockMovement", { groupBy: "branchId", measures: [{ op: "sum", field: "value", as: "value" }] }),
      safeList("goodsReceipt", 1000),
      safeList("product", 1000),
      safeList("supplier", 500),
      safeList("warehouse", 200),
      safeList("branch", 200),
    ]);

  const productName = new Map(products.map((p) => [String(p.id), String(p.name ?? p.sku ?? "—")]));
  const reorder = new Map(products.map((p) => [String(p.id), num(p.reorderLevel)]));
  const supplierName = new Map(suppliers.map((s) => [String(s.id), String(s.name ?? "—")]));
  const warehouseName = new Map(warehouses.map((w) => [String(w.id), String(w.name ?? w.code ?? "—")]));
  const branchName = new Map(branches.map((b) => [String(b.id), String(b.name ?? b.code ?? "—")]));

  // ── Goods receipts (mal giriş) ───────────────────────────────────────────
  const recvByGrn = new Map(recvByRef.map((r) => [String(r.key), { qty: num(r.measures.qty), value: num(r.measures.value) }]));
  const posted = grnList.filter((g) => String(g.status) === "posted");
  const receipts = posted
    .map((g) => {
      const v = recvByGrn.get(String(g.id)) ?? { qty: 0, value: 0 };
      return {
        number: String(g.number ?? g.id),
        supplierId: String(g.supplierId ?? ""),
        warehouseId: String(g.warehouseId ?? ""),
        date: g.receiptDate ? String(g.receiptDate) : "",
        qty: v.qty,
        value: v.value,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const recvUnits = receipts.reduce((s, r) => s + r.qty, 0);
  const recvValue = receipts.reduce((s, r) => s + r.value, 0);

  const supAgg = new Map<string, { count: number; qty: number; value: number }>();
  for (const r of receipts) {
    const s = supAgg.get(r.supplierId) ?? { count: 0, qty: 0, value: 0 };
    s.count += 1;
    s.qty += r.qty;
    s.value += r.value;
    supAgg.set(r.supplierId, s);
  }
  const supplierRows = [...supAgg.entries()]
    .map(([id, v]) => ({ name: supplierName.get(id) ?? "—", ...v }))
    .sort((a, b) => b.value - a.value);

  const whRows = recvByWarehouse
    .map((r) => ({ name: warehouseName.get(String(r.key)) ?? "—", qty: num(r.measures.qty), value: num(r.measures.value) }))
    .filter((r) => r.qty !== 0 || r.value !== 0)
    .sort((a, b) => b.value - a.value);

  const recvProductRows = recvByProduct
    .map((r) => ({ name: productName.get(String(r.key)) ?? "—", qty: num(r.measures.qty), value: num(r.measures.value) }))
    .filter((r) => r.qty !== 0 || r.value !== 0)
    .sort((a, b) => b.value - a.value);

  // ── Inventory (envanter) — net of all stock movements ────────────────────
  const invProducts = invByProduct
    .map((r) => ({ id: String(r.key), qty: num(r.measures.qty), value: num(r.measures.value) }))
    .filter((r) => r.qty !== 0 || r.value !== 0)
    .sort((a, b) => b.value - a.value);
  const onHandUnits = invProducts.reduce((s, r) => s + r.qty, 0);
  const stockValue = invProducts.reduce((s, r) => s + r.value, 0);
  const lowStock = invProducts.filter((r) => {
    const lvl = reorder.get(r.id) ?? 0;
    return lvl > 0 && r.qty < lvl;
  });

  const branchRows = invByBranch
    .map((r) => ({ name: branchName.get(String(r.key)) ?? "—", value: num(r.measures.value) }))
    .filter((r) => r.value !== 0)
    .sort((a, b) => b.value - a.value);

  const kpis = [
    { label: tr("report.grn.receipts"), value: fmtNumber(locale, posted.length) },
    { label: tr("report.grn.receivedUnits"), value: fmtNumber(locale, recvUnits) },
    { label: tr("report.grn.receivedValue"), value: fmtMoney(locale, recvValue) },
    { label: tr("report.inventory.units"), value: fmtNumber(locale, onHandUnits) },
    { label: tr("report.inventory.value"), value: fmtMoney(locale, stockValue) },
    { label: tr("report.inventory.lowStock"), value: fmtNumber(locale, lowStock.length) },
  ];

  const sections: ReportSection[] = [
    {
      title: tr("report.grn.bySupplier"),
      columns: [
        { label: tr("report.col.supplier") },
        { label: tr("report.col.count"), kind: "number" },
        { label: tr("report.col.qty"), kind: "number" },
        { label: tr("report.col.value"), kind: "currency" },
      ],
      rows: supplierRows.map((r) => [r.name, r.count, r.qty, r.value]),
      total: [tr("report.total"), posted.length, recvUnits, recvValue],
    },
    {
      title: tr("report.grn.byWarehouse"),
      columns: [
        { label: tr("report.col.warehouse") },
        { label: tr("report.col.qty"), kind: "number" },
        { label: tr("report.col.value"), kind: "currency" },
      ],
      rows: whRows.map((r) => [r.name, r.qty, r.value]),
      total: [tr("report.total"), whRows.reduce((s, r) => s + r.qty, 0), whRows.reduce((s, r) => s + r.value, 0)],
    },
    {
      title: tr("report.grn.byProduct"),
      columns: [
        { label: tr("report.col.product") },
        { label: tr("report.col.qty"), kind: "number" },
        { label: tr("report.col.value"), kind: "currency" },
      ],
      rows: recvProductRows.map((r) => [r.name, r.qty, r.value]),
      total: [tr("report.total"), recvProductRows.reduce((s, r) => s + r.qty, 0), recvProductRows.reduce((s, r) => s + r.value, 0)],
    },
    {
      title: tr("report.grn.recent"),
      columns: [
        { label: tr("report.col.number") },
        { label: tr("report.col.supplier") },
        { label: tr("report.col.warehouse") },
        { label: tr("report.col.date") },
        { label: tr("report.col.qty"), kind: "number" },
        { label: tr("report.col.value"), kind: "currency" },
      ],
      rows: receipts
        .slice(0, 30)
        .map((r) => [r.number, supplierName.get(r.supplierId) ?? "—", warehouseName.get(r.warehouseId) ?? "—", r.date ? fmtDate(locale, r.date) : "—", r.qty, r.value]),
    },
    {
      title: tr("report.inventory.byProduct"),
      columns: [
        { label: tr("report.col.product") },
        { label: tr("report.col.onHand"), kind: "number" },
        { label: tr("report.col.reorder"), kind: "number" },
        { label: tr("report.col.value"), kind: "currency" },
      ],
      rows: invProducts.map((r) => [productName.get(r.id) ?? "—", r.qty, reorder.get(r.id) ?? 0, r.value]),
      total: [tr("report.total"), onHandUnits, null, stockValue],
    },
    {
      title: tr("report.grn.lowStock"),
      columns: [
        { label: tr("report.col.product") },
        { label: tr("report.col.onHand"), kind: "number" },
        { label: tr("report.col.reorder"), kind: "number" },
        { label: tr("report.col.shortfall"), kind: "number" },
      ],
      rows: lowStock.map((r) => [productName.get(r.id) ?? "—", r.qty, reorder.get(r.id) ?? 0, Math.max(0, (reorder.get(r.id) ?? 0) - r.qty)]),
    },
  ];

  if (branchRows.length) {
    sections.push({
      title: tr("report.inventory.byBranch"),
      columns: [{ label: tr("report.col.branch") }, { label: tr("report.col.value"), kind: "currency" }],
      rows: branchRows.map((r) => [r.name, r.value]),
      total: [tr("report.total"), branchRows.reduce((s, r) => s + r.value, 0)],
    });
  }

  const payload: ReportPayload = {
    title: tr("report.grn.title"),
    subtitle: tr("report.grn.subtitle"),
    org: "Aula ERP",
    meta: [{ label: tr("report.generated"), value: fmtDateTime(locale, now) }],
    kpis,
    sections,
    currency: "USD",
  };

  return (
    <div className="space-y-4">
      <ReportHeader
        title={payload.title}
        subtitle={payload.subtitle}
        generated={`${tr("report.generated")}: ${fmtDateTime(locale, now)}`}
        payload={payload}
        fileName="goods-receipt-inventory-report"
        backLabel={tr("report.allReports")}
      />
      <ReportKpis kpis={kpis} />
      <ReportSections sections={sections} locale={locale} noData={tr("report.noData")} />
    </div>
  );
}
