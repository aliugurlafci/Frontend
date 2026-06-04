import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { ValueCell } from "@/components/crm/value-cell";
import { StageDonut, type ChartDatum } from "@/components/crm/dashboard-charts";
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

export default async function DealsDashboardPage() {
  const dealEntity = metadata.getEntity("deal");
  const stageField = dealEntity.fields.find((f) => f.name === "stage")!;
  const nameField = dealEntity.fields.find((f) => f.name === "name")!;
  const amountField = dealEntity.fields.find((f) => f.name === "amount")!;
  const closeField = dealEntity.fields.find((f) => f.name === "closeDate")!;

  let deals: EntityRecord[] = [];
  try {
    const res = await serverApi.list("deal", { pageSize: 500, sort: [{ field: "amount", dir: "desc" }] });
    deals = res.items;
  } catch {
    deals = [];
  }

  const byStage = new Map<string, { count: number; value: number }>();
  let totalValue = 0;
  let wonValue = 0;
  for (const d of deals) {
    const stage = String(d.stage ?? "lead");
    const amount = typeof d.amount === "number" ? d.amount : 0;
    const agg = byStage.get(stage) ?? { count: 0, value: 0 };
    agg.count += 1;
    agg.value += amount;
    byStage.set(stage, agg);
    totalValue += amount;
    if (stage === "won") wonValue += amount;
  }
  const avgDeal = deals.length > 0 ? totalValue / deals.length : 0;

  const distributionData: ChartDatum[] = (stageField.options ?? [])
    .map((o) => ({
      label: o.label,
      value: byStage.get(o.value)?.count ?? 0,
      color: TONE_COLOR[o.tone ?? "neutral"],
    }))
    .filter((d) => d.value > 0);

  const stats = [
    { label: "Total Deals", value: String(deals.length) },
    { label: "Total Value", value: usd(totalValue) },
    { label: "Won Value", value: usd(wonValue) },
    { label: "Avg Deal", value: usd(avgDeal) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Deals Dashboard</h1>
        <p className="text-xs text-muted">Opportunity distribution across the pipeline.</p>
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
          <CardHeader title="Deals by stage" />
          <CardBody>
            <StageDonut data={distributionData} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Pipeline breakdown" />
          <CardBody>
            <ul className="space-y-2">
              {(stageField.options ?? []).map((o) => {
                const agg = byStage.get(o.value);
                return (
                  <li key={o.value} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{o.label}</span>
                    <span className="tabular-nums text-muted">
                      {agg?.count ?? 0} · {usd(agg?.value ?? 0)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Deals" />
        <Table>
          <THead>
            <tr>
              <TH>Deal</TH>
              <TH>Stage</TH>
              <TH>Amount</TH>
              <TH>Close Date</TH>
            </tr>
          </THead>
          <tbody>
            {deals.slice(0, 10).map((d) => (
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
                <TD>
                  <ValueCell field={closeField} value={d.closeDate ?? null} />
                </TD>
              </TR>
            ))}
            {deals.length === 0 && (
              <TR>
                <TD>No deals.</TD>
              </TR>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
