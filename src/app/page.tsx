import { getServerContext } from "@/lib/http/server-context";
import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { ValueCell } from "@/components/crm/value-cell";
import { PipelineBarChart, StageDonut, type ChartDatum } from "@/components/crm/dashboard-charts";
import { DashboardCards } from "@/components/crm/dashboard-cards";

export const dynamic = "force-dynamic";

const TONE_COLOR: Record<string, string> = {
  neutral: "var(--muted-2)",
  info: "var(--info)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default async function DashboardPage() {
  const ctx = await getServerContext();
  const dealEntity = metadata.getEntity("deal");
  const stageField = dealEntity.fields.find((f) => f.name === "stage")!;
  const nameField = dealEntity.fields.find((f) => f.name === "name")!;
  const amountField = dealEntity.fields.find((f) => f.name === "amount")!;

  const [accounts, contacts, deals] = await Promise.all([
    serverApi.list("account", { pageSize: 1 }),
    serverApi.list("contact", { pageSize: 1 }),
    serverApi.list("deal", { pageSize: 500, sort: [{ field: "amount", dir: "desc" }] }),
  ]);
  const activity = await serverApi.activity(8);

  const byStage = new Map<string, { count: number; value: number }>();
  let openPipeline = 0;
  let wonValue = 0;
  for (const d of deals.items) {
    const stage = String(d.stage ?? "lead");
    const amount = typeof d.amount === "number" ? d.amount : 0;
    const agg = byStage.get(stage) ?? { count: 0, value: 0 };
    agg.count += 1;
    agg.value += amount;
    byStage.set(stage, agg);
    if (stage === "won") wonValue += amount;
    else if (stage !== "lost") openPipeline += amount;
  }

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
    { label: "Accounts", value: String(accounts.total) },
    { label: "Contacts", value: String(contacts.total) },
    { label: "Open Pipeline", value: usd.format(openPipeline) },
    { label: "Won", value: usd.format(wonValue) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-xs text-muted">Welcome back, {ctx.displayName}.</p>
      </div>

      <DashboardCards />

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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Pipeline value by stage" />
          <CardBody>
            <PipelineBarChart data={pipelineData} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Deals by stage" />
          <CardBody>
            <StageDonut data={distributionData} />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top deals" />
          <Table>
            <THead>
              <tr>
                <TH>Deal</TH>
                <TH>Stage</TH>
                <TH>Amount</TH>
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
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Recent activity" />
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
              {activity.length === 0 && <li className="text-xs text-muted">No activity yet.</li>}
            </ol>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
