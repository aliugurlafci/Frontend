import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { ValueCell } from "@/components/crm/value-cell";
import { PipelineBarChart, type ChartDatum } from "@/components/crm/dashboard-charts";
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

export default async function ExecutiveDashboardPage() {
  const dealEntity = metadata.getEntity("deal");
  const stageField = dealEntity.fields.find((f) => f.name === "stage")!;
  const dealNameField = dealEntity.fields.find((f) => f.name === "name")!;
  const dealAmountField = dealEntity.fields.find((f) => f.name === "amount")!;

  let accountsTotal = 0;
  let deals: EntityRecord[] = [];
  let invoices: EntityRecord[] = [];
  try {
    const res = await serverApi.list("account", { pageSize: 1 });
    accountsTotal = res.total;
  } catch {
    accountsTotal = 0;
  }
  try {
    const res = await serverApi.list("deal", { pageSize: 500, sort: [{ field: "amount", dir: "desc" }] });
    deals = res.items;
  } catch {
    deals = [];
  }
  try {
    const res = await serverApi.list("invoice", { pageSize: 500 });
    invoices = res.items;
  } catch {
    invoices = [];
  }

  const byStage = new Map<string, number>();
  let pipeline = 0;
  for (const d of deals) {
    const stage = String(d.stage ?? "lead");
    const amount = typeof d.amount === "number" ? d.amount : 0;
    byStage.set(stage, (byStage.get(stage) ?? 0) + amount);
    if (stage !== "won" && stage !== "lost") pipeline += amount;
  }

  let revenue = 0;
  let arOutstanding = 0;
  for (const inv of invoices) {
    const total = typeof inv.total === "number" ? inv.total : 0;
    const balance = typeof inv.balance === "number" ? inv.balance : 0;
    if (inv.status === "paid") revenue += total;
    arOutstanding += balance;
  }

  const pipelineData: ChartDatum[] = (stageField.options ?? [])
    .filter((o) => o.value !== "lost")
    .map((o) => ({
      label: o.label,
      value: byStage.get(o.value) ?? 0,
      color: TONE_COLOR[o.tone ?? "neutral"],
    }));

  const stats = [
    { label: "Revenue", value: usd(revenue) },
    { label: "AR Outstanding", value: usd(arOutstanding) },
    { label: "Pipeline", value: usd(pipeline) },
    { label: "Accounts", value: String(accountsTotal) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Executive Dashboard</h1>
        <p className="text-xs text-muted">Company-wide performance at a glance.</p>
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

      <Card>
        <CardHeader title="Pipeline value by stage" />
        <CardBody>
          <PipelineBarChart data={pipelineData} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Top opportunities" />
        <Table>
          <THead>
            <tr>
              <TH>Deal</TH>
              <TH>Stage</TH>
              <TH>Amount</TH>
            </tr>
          </THead>
          <tbody>
            {deals.slice(0, 8).map((d) => (
              <TR key={d.id}>
                <TD>
                  <ValueCell field={dealNameField} value={d.name ?? null} />
                </TD>
                <TD>
                  <ValueCell field={stageField} value={d.stage ?? null} />
                </TD>
                <TD>
                  <ValueCell field={dealAmountField} value={d.amount ?? null} />
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
