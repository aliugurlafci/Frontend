import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { AggregateRow } from "@/lib/data/query";

export const dynamic = "force-dynamic";

export default async function GrowthDashboardPage() {
  const dealEntity = metadata.getEntity("deal");
  const stageField = dealEntity.fields.find((f) => f.name === "stage")!;

  let accountsTotal = 0;
  let dealsTotal = 0;
  try {
    accountsTotal = (await serverApi.list("account", { pageSize: 1 })).total;
  } catch {
    accountsTotal = 0;
  }
  try {
    dealsTotal = (await serverApi.list("deal", { pageSize: 1 })).total;
  } catch {
    dealsTotal = 0;
  }

  let byStage: AggregateRow[] = [];
  try {
    byStage = await serverApi.aggregate("deal", {
      groupBy: "stage",
      measures: [{ op: "count", as: "count" }, { op: "sum", field: "amount", as: "value" }],
    });
  } catch {
    byStage = [];
  }

  const wonValue = Math.round(byStage.find((r) => r.key === "won")?.measures.value ?? 0);
  const openPipeline = Math.round(
    byStage.filter((r) => r.key !== "won" && r.key !== "lost").reduce((s, r) => s + (r.measures.value ?? 0), 0),
  );

  const stageLabel = (key: string | null) =>
    (stageField.options ?? []).find((o) => o.value === key)?.label ?? String(key ?? "—");

  const stats = [
    { label: "Accounts", value: String(accountsTotal) },
    { label: "Deals", value: String(dealsTotal) },
    { label: "Open Pipeline", value: `$${openPipeline.toLocaleString()}` },
    { label: "Won Value", value: `$${wonValue.toLocaleString()}` },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Growth Dashboard</h1>
        <p className="text-xs text-muted">Acquisition and pipeline growth.</p>
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
            <ul className="space-y-2">
              {byStage.map((r) => (
                <li key={String(r.key)} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{stageLabel(r.key)}</span>
                  <span className="tabular-nums text-muted">
                    {r.measures.count ?? 0} · ${(Math.round(r.measures.value ?? 0)).toLocaleString()}
                  </span>
                </li>
              ))}
              {byStage.length === 0 && <li className="text-xs text-muted">No data.</li>}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
