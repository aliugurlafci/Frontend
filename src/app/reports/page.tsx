import Link from "next/link";
import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import type { FieldDef } from "@/lib/metadata/types";
import type { AggregateRow } from "@/lib/data/query";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PipelineBarChart, StageDonut, type ChartDatum } from "@/components/crm/dashboard-charts";

export const dynamic = "force-dynamic";

const TONE_COLOR: Record<string, string> = {
  neutral: "var(--muted-2)",
  info: "var(--info)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

function toChartData(field: FieldDef, rows: AggregateRow[], measureKey: string): ChartDatum[] {
  const byKey = new Map(rows.map((r) => [r.key, r.measures[measureKey] ?? 0]));
  return (field.options ?? [])
    .map((o) => ({
      label: o.label,
      value: Math.round(byKey.get(o.value) ?? 0),
      color: TONE_COLOR[o.tone ?? "neutral"],
    }))
    .filter((d) => d.value > 0);
}

const REPORT_CATEGORIES: { href: string; title: string; description: string }[] = [
  { href: "/reports/deals", title: "Deal Reports", description: "Pipeline broken down by stage with deal-level detail." },
  { href: "/reports/leads", title: "Lead Reports", description: "Lead volume by source and status, with conversion stats." },
  { href: "/reports/sales", title: "Sales Reports", description: "Won revenue, open pipeline and stage performance." },
  { href: "/reports/revenue", title: "Revenue Reports", description: "Invoiced amounts by status and cash collected via payments." },
  { href: "/reports/projects", title: "Project Reports", description: "Project status mix, average progress and budget totals." },
];

export default async function ReportsPage() {
  const [dealByStage, leadBySource, invoiceByStatus] = await Promise.all([
    serverApi.aggregate("deal", { groupBy: "stage", measures: [{ op: "sum", field: "amount", as: "value" }] }),
    serverApi.aggregate("lead", { groupBy: "source", measures: [{ op: "count", as: "value" }] }),
    serverApi.aggregate("invoice", { groupBy: "status", measures: [{ op: "sum", field: "total", as: "value" }] }),
  ]);

  const stageField = metadata.getEntity("deal").fields.find((f) => f.name === "stage")!;
  const sourceField = metadata.getEntity("lead").fields.find((f) => f.name === "source")!;
  const statusField = metadata.getEntity("invoice").fields.find((f) => f.name === "status")!;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Reports</h1>
        <p className="text-xs text-muted">Sales &amp; revenue analytics</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pipeline value by stage" />
          <CardBody>
            <PipelineBarChart data={toChartData(stageField, dealByStage, "value")} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Invoiced revenue by status" />
          <CardBody>
            <PipelineBarChart data={toChartData(statusField, invoiceByStatus, "value")} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Leads by source" />
          <CardBody>
            <StageDonut data={toChartData(sourceField, leadBySource, "value")} />
          </CardBody>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold">Report library</h2>
        <p className="text-xs text-muted">Drill into a focused report</p>
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
