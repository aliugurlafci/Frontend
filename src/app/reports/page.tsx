import Link from "next/link";
import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import type { FieldDef, EntityRecord } from "@/lib/metadata/types";
import type { AggregateRow } from "@/lib/data/query";
import { getLocale } from "@/lib/i18n/server";
import { t as translate } from "@/lib/i18n/messages";
import { enumLabel } from "@/lib/i18n/labels";
import { fmtMoney, fmtDateTime } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ReportHeader, ReportKpis } from "@/components/crm/report-shell";
import type { ReportPayload, ReportSection } from "@/lib/reports/types";
import {
  PipelineBarChart,
  HBarChart,
  StageDonut,
  ChartLegend,
  CHART_PALETTE,
  type ChartDatum,
} from "@/components/crm/dashboard-charts";

export const dynamic = "force-dynamic";

const TONE_COLOR: Record<string, string> = {
  neutral: "var(--muted-2)",
  info: "var(--info)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

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

/** Enum field → chart data (localized labels, option order, tone colours). */
function toChartData(field: FieldDef, rows: AggregateRow[], measureKey: string, locale: Locale): ChartDatum[] {
  const byKey = new Map(rows.map((r) => [r.key, r.measures[measureKey] ?? 0]));
  return (field.options ?? [])
    .map((o) => ({ label: enumLabel(field, o.value, locale), value: Math.round(byKey.get(o.value) ?? 0), color: TONE_COLOR[o.tone ?? "neutral"] }))
    .filter((d) => d.value > 0);
}

/** Reference rows → ranked chart data, resolving ids to names via a lookup. */
function toRankedData(rows: AggregateRow[], names: Map<string, string>, measureKey: string, fallback: string, limit = 6): ChartDatum[] {
  return rows
    .map((r) => ({ label: r.key ? names.get(String(r.key)) ?? "—" : fallback, value: Math.round(r.measures[measureKey] ?? 0) }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((d, i) => ({ ...d, color: CHART_PALETTE[i % CHART_PALETTE.length] }));
}

export default async function ReportsPage() {
  const locale = await getLocale();
  const tr = (k: string, vars?: Record<string, string>) => translate(locale, k, vars);
  const now = new Date().toISOString();

  const [
    dealByStage,
    invoiceByStatus,
    stockByProduct,
    stockByBranch,
    billByStatus,
    paymentByMethod,
    tbByAccount,
    products,
    branches,
    ledgerAccounts,
  ] = await Promise.all([
    safeAgg("deal", { groupBy: "stage", measures: [{ op: "sum", field: "amount", as: "value" }] }),
    safeAgg("invoice", { groupBy: "status", measures: [{ op: "sum", field: "total", as: "value" }] }),
    safeAgg("stockMovement", { groupBy: "productId", measures: [{ op: "sum", field: "value", as: "value" }] }),
    safeAgg("stockMovement", { groupBy: "branchId", measures: [{ op: "sum", field: "value", as: "value" }] }),
    safeAgg("vendorBill", { groupBy: "status", measures: [{ op: "sum", field: "balance", as: "value" }] }),
    safeAgg("payment", { groupBy: "method", measures: [{ op: "sum", field: "amount", as: "value" }] }),
    safeAgg("journalLine", {
      groupBy: "ledgerAccountId",
      filters: [{ field: "posted", op: "eq", value: true }],
      measures: [
        { op: "sum", field: "debit", as: "debit" },
        { op: "sum", field: "credit", as: "credit" },
      ],
    }),
    safeList("product", 500),
    safeList("branch", 200),
    safeList("ledgerAccount", 500),
  ]);

  const stageField = metadata.getEntity("deal").fields.find((f) => f.name === "stage")!;
  const statusField = metadata.getEntity("invoice").fields.find((f) => f.name === "status")!;
  const billStatusField = metadata.getEntity("vendorBill").fields.find((f) => f.name === "status")!;
  const methodField = metadata.getEntity("payment").fields.find((f) => f.name === "method")!;

  const productName = new Map(products.map((p) => [String(p.id), String(p.name ?? p.sku ?? "—")]));
  const branchName = new Map(branches.map((b) => [String(b.id), String(b.name ?? b.code ?? "—")]));
  const unassigned = tr("report.col.branch");
  const topProducts = toRankedData(stockByProduct, productName, "value", tr("report.col.product"));
  const stockBranchData = toRankedData(stockByBranch, branchName, "value", unassigned, 8);

  // P&L from the posted trial balance, joined to account type.
  const accType = new Map(ledgerAccounts.map((a) => [String(a.id), String(a.type ?? "")]));
  let revenue = 0;
  let expense = 0;
  for (const r of tbByAccount) {
    const type = accType.get(String(r.key));
    const dr = r.measures.debit ?? 0;
    const cr = r.measures.credit ?? 0;
    if (type === "revenue") revenue += cr - dr;
    else if (type === "expense") expense += dr - cr;
  }
  const plData: ChartDatum[] = [
    { label: tr("report.finance.revenue"), value: Math.round(revenue), color: TONE_COLOR.success },
    { label: tr("report.finance.expenses"), value: Math.round(expense), color: TONE_COLOR.danger },
    { label: tr("report.finance.netIncome"), value: Math.round(revenue - expense), color: TONE_COLOR.info },
  ].filter((d) => d.value !== 0);

  const pipelineData = toChartData(stageField, dealByStage, "value", locale);
  const invoiceData = toChartData(statusField, invoiceByStatus, "value", locale);
  const billData = toChartData(billStatusField, billByStatus, "value", locale);
  const cashData = toChartData(methodField, paymentByMethod, "value", locale);

  // ── KPI strip + export payload (tabular versions of the charts) ─────────
  const sum = (d: ChartDatum[]) => d.reduce((s, x) => s + x.value, 0);
  const kpis = [
    { label: tr("report.sales.openPipeline"), value: fmtMoney(locale, sum(pipelineData)) },
    { label: tr("report.revenue.invoiced"), value: fmtMoney(locale, sum(invoiceData)) },
    { label: tr("report.inventory.value"), value: fmtMoney(locale, sum(stockBranchData)) },
    { label: tr("report.finance.netIncome"), value: fmtMoney(locale, Math.round(revenue - expense)) },
  ];

  const toSection = (title: string, nameLabel: string, data: ChartDatum[]): ReportSection => ({
    title,
    columns: [{ label: nameLabel }, { label: tr("report.col.value"), kind: "currency" }],
    rows: data.map((d) => [d.label, d.value]),
    total: [tr("report.total"), sum(data)],
  });

  const sections: ReportSection[] = [
    toSection(tr("report.chart.pipelineByStage"), tr("report.col.stage"), pipelineData),
    toSection(tr("report.chart.invoicedByStatus"), tr("report.col.status"), invoiceData),
    toSection(tr("report.chart.topProducts"), tr("report.col.product"), topProducts),
    toSection(tr("report.chart.stockByBranch"), tr("report.col.branch"), stockBranchData),
    toSection(tr("report.chart.pnl"), tr("report.col.type"), plData),
    toSection(tr("report.chart.payablesByStatus"), tr("report.col.status"), billData),
    toSection(tr("report.chart.cashByMethod"), tr("report.col.method"), cashData),
  ].filter((s) => s.rows.length > 0);

  const payload: ReportPayload = {
    title: tr("report.overview.title"),
    subtitle: tr("report.overview.subtitle"),
    org: "Aula ERP",
    meta: [{ label: tr("report.generated"), value: fmtDateTime(locale, now) }],
    kpis,
    sections,
    currency: "USD",
  };

  const library: { href: string; title: string; description: string }[] = [
    { href: "/reports/deals", title: tr("report.deals.title"), description: tr("report.lib.deals") },
    { href: "/reports/sales", title: tr("report.sales.title"), description: tr("report.lib.sales") },
    { href: "/reports/revenue", title: tr("report.revenue.title"), description: tr("report.lib.revenue") },
    { href: "/reports/inventory", title: tr("report.inventory.title"), description: tr("report.lib.inventory") },
    { href: "/reports/goods-receipt", title: tr("report.grn.title"), description: tr("report.lib.grn") },
    { href: "/reports/finance", title: tr("report.finance.title"), description: tr("report.lib.finance") },
  ];

  return (
    <div className="space-y-6">
      <ReportHeader
        title={payload.title}
        subtitle={payload.subtitle}
        generated={`${tr("report.generated")}: ${fmtDateTime(locale, now)}`}
        payload={payload}
        fileName="reports-overview"
      />

      <ReportKpis kpis={kpis} />

      <Section title={tr("report.section.sales")}>
        <ChartCard title={tr("report.chart.pipelineByStage")} data={pipelineData} noData={tr("report.noData")}>
          <PipelineBarChart data={pipelineData} kind="currency" />
        </ChartCard>
        <ChartCard title={tr("report.chart.invoicedByStatus")} data={invoiceData} noData={tr("report.noData")}>
          <PipelineBarChart data={invoiceData} kind="currency" />
        </ChartCard>
      </Section>

      <Section title={tr("report.section.inventory")}>
        <ChartCard title={tr("report.chart.topProducts")} data={topProducts} noData={tr("report.noData")}>
          <HBarChart data={topProducts} kind="currency" />
        </ChartCard>
        <ChartCard title={tr("report.chart.stockByBranch")} data={stockBranchData} noData={tr("report.noData")}>
          <StageDonut data={stockBranchData} kind="currency" />
          <ChartLegend data={stockBranchData} kind="currency" />
        </ChartCard>
      </Section>

      <Section title={tr("report.section.finance")}>
        <ChartCard title={tr("report.chart.pnl")} data={plData} noData={tr("report.noData")}>
          <PipelineBarChart data={plData} kind="currency" />
        </ChartCard>
        <ChartCard title={tr("report.chart.payablesByStatus")} data={billData} noData={tr("report.noData")}>
          <PipelineBarChart data={billData} kind="currency" />
        </ChartCard>
        <ChartCard title={tr("report.chart.cashByMethod")} data={cashData} noData={tr("report.noData")}>
          <StageDonut data={cashData} kind="currency" />
        </ChartCard>
      </Section>

      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{tr("report.library")}</h2>
        <p className="text-xs text-muted">{tr("report.libraryHint")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {library.map((c) => (
          <Card key={c.href}>
            <CardHeader title={c.title} />
            <CardBody className="space-y-3 text-sm">
              <p className="text-muted">{c.description}</p>
              <Link href={c.href} className="inline-flex text-xs font-medium text-primary hover:underline">
                {tr("report.viewReport")}
              </Link>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function ChartCard({ title, data, noData, children }: { title: string; data: ChartDatum[]; noData: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        {data.length ? children : <div className="flex h-[200px] items-center justify-center text-xs text-muted">{noData}</div>}
      </CardBody>
    </Card>
  );
}
