import { serverApi } from "@/lib/http/server-api";
import { getT } from "@/lib/i18n/server";
import { metadata } from "@/lib/metadata";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { ValueCell } from "@/components/crm/value-cell";
import { PipelineBarChart, StageDonut, type ChartDatum } from "@/components/crm/dashboard-charts";
import type { EntityRecord } from "@/lib/metadata/types";

export const dynamic = "force-dynamic";

const TONE_COLOR: Record<string, string> = {
  neutral: "var(--muted-2)",
  info: "var(--info)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

const usd = (n: number) => "$" + Math.round(n).toLocaleString();

export default async function SalesDashboardPage() {
  const t = await getT();
  const dealEntity = metadata.getEntity("deal");
  const stageField = dealEntity.fields.find((f) => f.name === "stage")!;
  const nameField = dealEntity.fields.find((f) => f.name === "name")!;
  const amountField = dealEntity.fields.find((f) => f.name === "amount")!;

  let deals: EntityRecord[] = [];
  try {
    const res = await serverApi.list("deal", { pageSize: 500, sort: [{ field: "amount", dir: "desc" }] });
    deals = res.items;
  } catch {
    deals = [];
  }

  const byStage = new Map<string, { count: number; value: number }>();
  let openPipeline = 0;
  let wonValue = 0;
  let openCount = 0;
  let wonCount = 0;
  let lostCount = 0;
  for (const d of deals) {
    const stage = String(d.stage ?? "lead");
    const amount = typeof d.amount === "number" ? d.amount : 0;
    const agg = byStage.get(stage) ?? { count: 0, value: 0 };
    agg.count += 1;
    agg.value += amount;
    byStage.set(stage, agg);
    if (stage === "won") {
      wonValue += amount;
      wonCount += 1;
    } else if (stage === "lost") {
      lostCount += 1;
    } else {
      openPipeline += amount;
      openCount += 1;
    }
  }
  const closed = wonCount + lostCount;
  const winRate = closed > 0 ? Math.round((wonCount / closed) * 100) : 0;

  const pipelineData: ChartDatum[] = (stageField.options ?? [])
    .filter((o) => o.value !== "lost")
    .map((o) => ({
      label: o.label,
      value: byStage.get(o.value)?.value ?? 0,
      color: TONE_COLOR[o.tone ?? "neutral"],
    }));
  const distributionData: ChartDatum[] = (stageField.options ?? [])
    .map((o) => ({
      label: o.label,
      value: byStage.get(o.value)?.count ?? 0,
      color: TONE_COLOR[o.tone ?? "neutral"],
    }))
    .filter((d) => d.value > 0);

  const stats = [
    { label: t("salesDash.kpi.totalPipeline"), value: usd(openPipeline) },
    { label: t("salesDash.kpi.won"), value: usd(wonValue) },
    { label: t("salesDash.kpi.openDeals"), value: String(openCount) },
    { label: t("salesDash.kpi.winRate"), value: `${winRate}%` },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{t("salesDash.title")}</h1>
        <p className="text-xs text-muted">{t("salesDash.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardBody>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("salesDash.pipelineByStage")} />
          <CardBody>
            <PipelineBarChart data={pipelineData} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("salesDash.dealsByStage")} />
          <CardBody>
            <StageDonut data={distributionData} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={t("salesDash.topDealsByAmount")} />
        <Table>
          <THead>
            <tr>
              <TH>{t("col.deal")}</TH>
              <TH>{t("col.stage")}</TH>
              <TH>{t("col.amount")}</TH>
            </tr>
          </THead>
          <tbody>
            {deals.slice(0, 8).map((d) => (
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
            {deals.length === 0 && (
              <TR>
                <TD>{t("salesDash.noDeals")}</TD>
              </TR>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
