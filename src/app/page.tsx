import { getServerContext } from "@/lib/http/server-context";
import { serverApi } from "@/lib/http/server-api";
import { getT } from "@/lib/i18n/server";
import { metadata } from "@/lib/metadata";
import type { AggregateRow, Measure } from "@/lib/data/query";
import type { EntityRecord } from "@/lib/metadata/types";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { ValueCell } from "@/components/crm/value-cell";
import {
  PipelineBarChart,
  HBarChart,
  StageDonut,
  ChartLegend,
  CHART_PALETTE,
  type ChartDatum,
} from "@/components/crm/dashboard-charts";
import { DashboardCards } from "@/components/crm/dashboard-cards";

export const dynamic = "force-dynamic";

const TONE_COLOR: Record<string, string> = {
  neutral: "var(--muted-2)",
  info: "var(--info)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Aggregations gracefully degrade to [] when the caller lacks read access. */
async function safeAgg(entity: string, groupBy: string, measures: Measure[]): Promise<AggregateRow[]> {
  try {
    return await serverApi.aggregate(entity, { groupBy, measures });
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

const sumMeasure = (rows: AggregateRow[], key: string) => rows.reduce((s, r) => s + (r.measures[key] ?? 0), 0);

export default async function DashboardPage() {
  const ctx = await getServerContext();
  const me = await serverApi.me();
  const t = await getT();
  // The "Recent activity" card surfaces the same audit trail as the standalone
  // /activity page, so it's gated by the same "activity" screen permission
  // (Settings → Roles & Permissions). Admins always see it; otherwise the
  // user's position must grant the "activity" screen. `me` is request-cached,
  // so this shares AppShell's single /auth/me round-trip.
  const canViewActivity = me.roles.includes("admin") || me.screens.includes("activity");
  const dealEntity = metadata.getEntity("deal");
  const stageField = dealEntity.fields.find((f) => f.name === "stage")!;
  const nameField = dealEntity.fields.find((f) => f.name === "name")!;
  const amountField = dealEntity.fields.find((f) => f.name === "amount")!;
  const invStatusField = metadata.getEntity("invoice").fields.find((f) => f.name === "status")!;

  const [
    invoiceByStatus,
    paymentByMethod,
    stockByProduct,
    stockByBranch,
    deals,
    products,
    branches,
    activity,
  ] = await Promise.all([
    safeAgg("invoice", "status", [
      { op: "sum", field: "total", as: "total" },
      { op: "sum", field: "balance", as: "balance" },
    ]),
    safeAgg("payment", "method", [{ op: "sum", field: "amount", as: "amount" }]),
    safeAgg("stockMovement", "productId", [{ op: "sum", field: "value", as: "value" }]),
    safeAgg("stockMovement", "branchId", [{ op: "sum", field: "value", as: "value" }]),
    serverApi.list("deal", { pageSize: 500, sort: [{ field: "amount", dir: "desc" }] }).catch(() => ({ items: [] as EntityRecord[] })),
    safeList("product", 500),
    safeList("branch", 200),
    canViewActivity ? serverApi.activity(8).catch(() => []) : Promise.resolve([]),
  ]);

  // --- KPIs ---
  const invoiced = sumMeasure(invoiceByStatus, "total");
  const arOutstanding = sumMeasure(invoiceByStatus, "balance");
  const inventoryValue = sumMeasure(stockByProduct, "value");
  const cashCollected = sumMeasure(paymentByMethod, "amount");

  // --- Pipeline (open deals) ---
  const byStage = new Map<string, { count: number; value: number }>();
  let openPipeline = 0;
  for (const d of deals.items) {
    const stage = String(d.stage ?? "lead");
    const amount = typeof d.amount === "number" ? d.amount : 0;
    const agg = byStage.get(stage) ?? { count: 0, value: 0 };
    agg.count += 1;
    agg.value += amount;
    byStage.set(stage, agg);
    if (stage !== "won" && stage !== "lost") openPipeline += amount;
  }
  const pipelineData: ChartDatum[] = (stageField.options ?? [])
    .filter((o) => o.value !== "lost" && o.value !== "won")
    .map((o) => ({ label: o.label, value: byStage.get(o.value)?.value ?? 0, color: TONE_COLOR[o.tone ?? "neutral"] }))
    .filter((d) => d.value > 0);

  // --- Charts ---
  const invStatusData: ChartDatum[] = (invStatusField.options ?? [])
    .map((o) => ({
      label: o.label,
      value: Math.round(invoiceByStatus.find((r) => r.key === o.value)?.measures.total ?? 0),
      color: TONE_COLOR[o.tone ?? "neutral"],
    }))
    .filter((d) => d.value > 0);

  const productName = new Map(products.map((p) => [String(p.id), String(p.name ?? p.sku ?? "—")]));
  const topProducts: ChartDatum[] = stockByProduct
    .map((r) => ({ label: productName.get(String(r.key)) ?? "—", value: Math.round(r.measures.value ?? 0) }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((d, i) => ({ ...d, color: CHART_PALETTE[i % CHART_PALETTE.length] }));

  const branchName = new Map(branches.map((b) => [String(b.id), String(b.name ?? b.code ?? "—")]));
  const stockBranchData: ChartDatum[] = stockByBranch
    .map((r, i) => ({
      label: r.key ? branchName.get(String(r.key)) ?? "—" : t("dash.unassigned"),
      value: Math.round(r.measures.value ?? 0),
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    }))
    .filter((d) => d.value > 0);

  const stats = [
    { label: t("dash.kpi.invoiced"), value: usd.format(invoiced) },
    { label: t("dash.kpi.outstandingAr"), value: usd.format(arOutstanding) },
    { label: t("dash.kpi.inventoryValue"), value: usd.format(inventoryValue) },
    { label: t("dash.kpi.cashCollected"), value: usd.format(cashCollected) },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("dash.title")}</h1>
        <p className="mt-0.5 text-sm text-muted">{t("dash.welcome", { name: ctx.displayName })}</p>
      </div>

      <DashboardCards />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="overflow-hidden">
            <CardBody className="relative">
              <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary to-secondary opacity-70" aria-hidden />
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{s.label}</p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums">{s.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t("dash.invoicedByStatus")} />
          <CardBody>
            {invStatusData.length ? (
              <PipelineBarChart data={invStatusData} kind="currency" />
            ) : (
              <EmptyChart label={t("dash.noData")} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("dash.stockByBranch")} />
          <CardBody>
            {stockBranchData.length ? (
              <>
                <StageDonut data={stockBranchData} kind="currency" />
                <ChartLegend data={stockBranchData} kind="currency" />
              </>
            ) : (
              <EmptyChart label={t("dash.noData")} />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("dash.topProducts")} />
          <CardBody>
            {topProducts.length ? <HBarChart data={topProducts} kind="currency" /> : <EmptyChart label={t("dash.noData")} />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("dash.openPipeline")} />
          <CardBody>
            {pipelineData.length ? <PipelineBarChart data={pipelineData} kind="currency" /> : <EmptyChart label={t("dash.noData")} />}
          </CardBody>
        </Card>
      </div>

      <div className={`grid gap-4 ${canViewActivity ? "lg:grid-cols-2" : ""}`}>
        <Card>
          <CardHeader
            title={t("dash.topDeals")}
            action={<span className="text-xs text-muted">{t("dash.open", { amount: usd.format(openPipeline) })}</span>}
          />
          <Table>
            <THead>
              <tr>
                <TH>{t("col.deal")}</TH>
                <TH>{t("col.stage")}</TH>
                <TH>{t("col.amount")}</TH>
              </tr>
            </THead>
            <tbody>
              {deals.items.slice(0, 6).map((d) => (
                <TR key={d.id}>
                  <TD>
                    <ValueCell field={nameField} value={d.name ?? null} />
                  </TD>
                  <TD>
                    <ValueCell field={stageField} value={d.stage ?? null} />
                  </TD>
                  <TD>
                    <ValueCell field={amountField} value={d.amount ?? null} />
                  </TD>
                </TR>
              ))}
              {deals.items.length === 0 && (
                <TR>
                  <TD>{t("dash.noDeals")}</TD>
                </TR>
              )}
            </tbody>
          </Table>
        </Card>

        {canViewActivity && (
          <Card>
            <CardHeader title={t("dash.recentActivity")} />
            <CardBody>
              <ol className="space-y-2.5 border-l border-border pl-3">
                {activity.map((a) => (
                  <li key={a.id} className="relative text-xs">
                    <span className="absolute -left-[1.45rem] top-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="text-foreground">{a.summary}</span>{" "}
                    <Badge tone="neutral">{a.entity}</Badge>
                    <div className="text-muted">{new Date(a.at).toLocaleString()}</div>
                  </li>
                ))}
                {activity.length === 0 && <li className="text-xs text-muted">{t("dash.noActivity")}</li>}
              </ol>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="flex h-[240px] items-center justify-center text-xs text-muted">{label}</div>;
}
