import { serverApi } from "@/lib/http/server-api";
import type { AggregateRow } from "@/lib/data/query";
import type { EntityRecord } from "@/lib/metadata/types";
import { getLocale } from "@/lib/i18n/server";
import { t as translate } from "@/lib/i18n/messages";
import { fmtMoney, fmtNumber, fmtDateTime } from "@/lib/i18n/format";
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

export default async function InventoryReportsPage() {
  const locale = await getLocale();
  const tr = (k: string, vars?: Record<string, string>) => translate(locale, k, vars);
  const now = new Date().toISOString();

  const [byProduct, byBranch, products, branches] = await Promise.all([
    safeAgg("stockMovement", {
      groupBy: "productId",
      measures: [
        { op: "sum", field: "qty", as: "qty" },
        { op: "sum", field: "value", as: "value" },
      ],
    }),
    safeAgg("stockMovement", { groupBy: "branchId", measures: [{ op: "sum", field: "value", as: "value" }] }),
    safeList("product", 1000),
    safeList("branch", 200),
  ]);

  const productName = new Map(products.map((p) => [String(p.id), String(p.name ?? p.sku ?? "—")]));
  const reorder = new Map(products.map((p) => [String(p.id), num(p.reorderLevel)]));
  const branchName = new Map(branches.map((b) => [String(b.id), String(b.name ?? b.code ?? "—")]));

  const productRows = byProduct
    .map((r) => ({ id: String(r.key), qty: num(r.measures.qty), value: num(r.measures.value) }))
    .filter((r) => r.qty !== 0 || r.value !== 0)
    .sort((a, b) => b.value - a.value);

  const unitsOnHand = productRows.reduce((s, r) => s + r.qty, 0);
  const stockValue = productRows.reduce((s, r) => s + r.value, 0);
  const lowStock = productRows.filter((r) => {
    const level = reorder.get(r.id) ?? 0;
    return level > 0 && r.qty < level;
  }).length;

  const branchRows = byBranch
    .map((r) => ({ name: branchName.get(String(r.key)) ?? "—", value: num(r.measures.value) }))
    .filter((r) => r.value !== 0)
    .sort((a, b) => b.value - a.value);
  const branchTotal = branchRows.reduce((s, r) => s + r.value, 0);

  const kpis = [
    { label: tr("report.inventory.skus"), value: fmtNumber(locale, productRows.length) },
    { label: tr("report.inventory.units"), value: fmtNumber(locale, unitsOnHand) },
    { label: tr("report.inventory.value"), value: fmtMoney(locale, stockValue) },
    { label: tr("report.inventory.lowStock"), value: fmtNumber(locale, lowStock) },
  ];

  const productSection: ReportSection = {
    title: tr("report.inventory.byProduct"),
    columns: [
      { label: tr("report.col.product") },
      { label: tr("report.col.qty"), kind: "number" },
      { label: tr("report.col.reorder"), kind: "number" },
      { label: tr("report.col.value"), kind: "currency" },
    ],
    rows: productRows.map((r) => [productName.get(r.id) ?? "—", r.qty, reorder.get(r.id) ?? 0, r.value]),
    total: [tr("report.total"), unitsOnHand, null, stockValue],
  };

  const branchSection: ReportSection = {
    title: tr("report.inventory.byBranch"),
    columns: [
      { label: tr("report.col.branch") },
      { label: tr("report.col.value"), kind: "currency" },
    ],
    rows: branchRows.map((r) => [r.name, r.value]),
    total: [tr("report.total"), branchTotal],
  };

  const sections = [productSection, branchSection];
  const payload: ReportPayload = {
    title: tr("report.inventory.title"),
    subtitle: tr("report.inventory.subtitle"),
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
        fileName="inventory-report"
        backLabel={tr("report.allReports")}
      />
      <ReportKpis kpis={kpis} />
      <ReportSections sections={sections} locale={locale} noData={tr("report.noData")} />
    </div>
  );
}
