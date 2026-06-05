import Link from "next/link";
import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import type { FieldDef, EntityRecord } from "@/lib/metadata/types";
import type { AggregateRow } from "@/lib/data/query";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
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

/** Enum field → chart data, keeping the option order, labels and tone colours. */
function toChartData(field: FieldDef, rows: AggregateRow[], measureKey: string): ChartDatum[] {
  const byKey = new Map(rows.map((r) => [r.key, r.measures[measureKey] ?? 0]));
  return (field.options ?? [])
    .map((o) => ({ label: o.label, value: Math.round(byKey.get(o.value) ?? 0), color: TONE_COLOR[o.tone ?? "neutral"] }))
    .filter((d) => d.value > 0);
}

/** Reference rows → ranked chart data, resolving ids to names via a lookup. */
function toRankedData(rows: AggregateRow[], names: Map<string, string>, measureKey: string, limit = 6): ChartDatum[] {
  return rows
    .map((r) => ({ label: r.key ? names.get(String(r.key)) ?? "—" : "Unassigned", value: Math.round(r.measures[measureKey] ?? 0) }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((d, i) => ({ ...d, color: CHART_PALETTE[i % CHART_PALETTE.length] }));
}

const REPORT_CATEGORIES: { href: string; title: string; description: string }[] = [
  { href: "/reports/deals", title: "Deal Reports", description: "Pipeline broken down by stage with deal-level detail." },
  { href: "/reports/leads", title: "Lead Reports", description: "Lead volume by source and status, with conversion stats." },
  { href: "/reports/sales", title: "Sales Reports", description: "Won revenue, open pipeline and stage performance." },
  { href: "/reports/revenue", title: "Revenue Reports", description: "Invoiced amounts by status and cash collected via payments." },
  { href: "/inventory-dashboard", title: "Inventory", description: "Stock on hand, valuation and reorder alerts by product." },
  { href: "/accounting-dashboard", title: "Accounting", description: "Trial balance, profit & loss and the balance sheet." },
  { href: "/branch-dashboard", title: "Branch & Dealer", description: "Sales, receivables and stock value per branch." },
];

export default async function ReportsPage() {
  const [
    dealByStage,
    invoiceByStatus,
    leadBySource,
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
    safeAgg("lead", { groupBy: "source", measures: [{ op: "count", as: "value" }] }),
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
  const sourceField = metadata.getEntity("lead").fields.find((f) => f.name === "source")!;
  const statusField = metadata.getEntity("invoice").fields.find((f) => f.name === "status")!;
  const billStatusField = metadata.getEntity("vendorBill").fields.find((f) => f.name === "status")!;
  const methodField = metadata.getEntity("payment").fields.find((f) => f.name === "method")!;

  const productName = new Map(products.map((p) => [String(p.id), String(p.name ?? p.sku ?? "—")]));
  const branchName = new Map(branches.map((b) => [String(b.id), String(b.name ?? b.code ?? "—")]));
  const topProducts = toRankedData(stockByProduct, productName, "value");
  const stockBranchData = toRankedData(stockByBranch, branchName, "value", 8);

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
    { label: "Revenue", value: Math.round(revenue), color: TONE_COLOR.success },
    { label: "Expenses", value: Math.round(expense), color: TONE_COLOR.danger },
    { label: "Net income", value: Math.round(revenue - expense), color: TONE_COLOR.info },
  ].filter((d) => d.value !== 0);

  const pipelineData = toChartData(stageField, dealByStage, "value");
  const invoiceData = toChartData(statusField, invoiceByStatus, "value");
  const leadData = toChartData(sourceField, leadBySource, "value");
  const billData = toChartData(billStatusField, billByStatus, "value");
  const cashData = toChartData(methodField, paymentByMethod, "value");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Reports</h1>
        <p className="text-xs text-muted">Sales, inventory, finance &amp; accounting analytics</p>
      </div>

      <Section title="Sales & pipeline">
        <ChartCard title="Pipeline value by stage" data={pipelineData}>
          <PipelineBarChart data={pipelineData} kind="currency" />
        </ChartCard>
        <ChartCard title="Invoiced revenue by status" data={invoiceData}>
          <PipelineBarChart data={invoiceData} kind="currency" />
        </ChartCard>
        <ChartCard title="Leads by source" data={leadData}>
          <StageDonut data={leadData} kind="number" unitLabel="leads" />
        </ChartCard>
      </Section>

      <Section title="Inventory">
        <ChartCard title="Top products by stock value" data={topProducts}>
          <HBarChart data={topProducts} kind="currency" />
        </ChartCard>
        <ChartCard title="Stock value by branch" data={stockBranchData}>
          <StageDonut data={stockBranchData} kind="currency" />
          <ChartLegend data={stockBranchData} kind="currency" />
        </ChartCard>
      </Section>

      <Section title="Finance & accounting">
        <ChartCard title="Profit & loss" data={plData}>
          <PipelineBarChart data={plData} kind="currency" />
        </ChartCard>
        <ChartCard title="Payables by status" data={billData}>
          <PipelineBarChart data={billData} kind="currency" />
        </ChartCard>
        <ChartCard title="Cash received by method" data={cashData}>
          <StageDonut data={cashData} kind="currency" />
        </ChartCard>
      </Section>

      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Report library</h2>
        <p className="text-xs text-muted">Drill into a focused report or dashboard</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_CATEGORIES.map((c) => (
          <Card key={c.href}>
            <CardHeader title={c.title} />
            <CardBody className="space-y-3 text-sm">
              <p className="text-muted">{c.description}</p>
              <Link href={c.href} className="inline-flex text-xs font-medium text-primary hover:underline">
                View report →
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

function ChartCard({ title, data, children }: { title: string; data: ChartDatum[]; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        {data.length ? children : <div className="flex h-[200px] items-center justify-center text-xs text-muted">No data to display.</div>}
      </CardBody>
    </Card>
  );
}
