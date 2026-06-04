import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { ValueCell } from "@/components/crm/value-cell";
import type { EntityRecord } from "@/lib/metadata/types";
import type { AggregateRow } from "@/lib/data/query";

export const dynamic = "force-dynamic";

const usd = (n: number) => "$" + Math.round(n).toLocaleString();

export default async function LeadsDashboardPage() {
  const leadEntity = metadata.getEntity("lead");
  const nameField = leadEntity.fields.find((f) => f.name === "name")!;
  const companyField = leadEntity.fields.find((f) => f.name === "company")!;
  const sourceField = leadEntity.fields.find((f) => f.name === "source")!;
  const statusField = leadEntity.fields.find((f) => f.name === "status")!;
  const valueField = leadEntity.fields.find((f) => f.name === "estimatedValue")!;

  let leads: EntityRecord[] = [];
  let total = 0;
  try {
    const res = await serverApi.list("lead", { pageSize: 500, sort: [{ field: "name", dir: "asc" }] });
    leads = res.items;
    total = res.total;
  } catch {
    leads = [];
  }

  let bySource: AggregateRow[] = [];
  let byStatus: AggregateRow[] = [];
  try {
    bySource = await serverApi.aggregate("lead", {
      groupBy: "source",
      measures: [{ op: "count", as: "count" }],
    });
  } catch {
    bySource = [];
  }
  try {
    byStatus = await serverApi.aggregate("lead", {
      groupBy: "status",
      measures: [{ op: "count", as: "count" }],
    });
  } catch {
    byStatus = [];
  }

  const statusCount = (status: string) =>
    byStatus.find((r) => r.key === status)?.measures.count ?? 0;
  const estValue = leads.reduce(
    (sum, l) => sum + (typeof l.estimatedValue === "number" ? l.estimatedValue : 0),
    0,
  );

  const stats = [
    { label: "Total Leads", value: String(total || leads.length) },
    { label: "New", value: String(statusCount("new")) },
    { label: "Working", value: String(statusCount("working")) },
    { label: "Est. Value", value: usd(estValue) },
  ];

  const sourceLabel = (key: string | null) =>
    (sourceField.options ?? []).find((o) => o.value === key)?.label ?? String(key ?? "—");
  const statusLabel = (key: string | null) =>
    (statusField.options ?? []).find((o) => o.value === key)?.label ?? String(key ?? "—");
  const maxSource = Math.max(1, ...bySource.map((r) => r.measures.count ?? 0));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Leads Dashboard</h1>
        <p className="text-xs text-muted">Top-of-funnel volume and qualification.</p>
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
          <CardHeader title="Leads by source" />
          <CardBody>
            <ul className="space-y-2.5">
              {bySource.map((r) => {
                const count = r.measures.count ?? 0;
                return (
                  <li key={String(r.key)} className="text-xs">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-foreground">{sourceLabel(r.key)}</span>
                      <span className="tabular-nums text-muted">{count}</span>
                    </div>
                    <div className="h-1.5 rounded bg-surface-2">
                      <div
                        className="h-1.5 rounded bg-primary"
                        style={{ width: `${Math.round((count / maxSource) * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
              {bySource.length === 0 && <li className="text-xs text-muted">No data.</li>}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Leads by status" />
          <CardBody>
            <ul className="space-y-2">
              {byStatus.map((r) => (
                <li key={String(r.key)} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{statusLabel(r.key)}</span>
                  <span className="tabular-nums text-muted">{r.measures.count ?? 0}</span>
                </li>
              ))}
              {byStatus.length === 0 && <li className="text-xs text-muted">No data.</li>}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent leads" />
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Company</TH>
              <TH>Source</TH>
              <TH>Status</TH>
              <TH>Est. Value</TH>
            </tr>
          </THead>
          <tbody>
            {leads.slice(0, 8).map((l) => (
              <TR key={l.id}>
                <TD>
                  <ValueCell field={nameField} value={l.name ?? null} />
                </TD>
                <TD>
                  <ValueCell field={companyField} value={l.company ?? null} />
                </TD>
                <TD>
                  <ValueCell field={sourceField} value={l.source ?? null} />
                </TD>
                <TD>
                  <ValueCell field={statusField} value={l.status ?? null} />
                </TD>
                <TD>
                  <ValueCell field={valueField} value={l.estimatedValue ?? null} />
                </TD>
              </TR>
            ))}
            {leads.length === 0 && (
              <TR>
                <TD>No leads.</TD>
              </TR>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
