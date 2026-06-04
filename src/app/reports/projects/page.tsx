import Link from "next/link";
import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import type { AggregateRow } from "@/lib/data/query";
import { formatMoney } from "@/lib/finance/money";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { enumTone } from "@/components/crm/field-format";

export const dynamic = "force-dynamic";

function num(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

export default async function ProjectReportsPage() {
  const statusField = metadata.getEntity("project").fields.find((f) => f.name === "status")!;
  const statusLabel = new Map((statusField.options ?? []).map((o) => [o.value, o.label] as const));

  let byStatus: AggregateRow[] = [];
  let totals: AggregateRow[] = [];
  try {
    [byStatus, totals] = await Promise.all([
      serverApi.aggregate("project", {
        groupBy: "status",
        measures: [
          { op: "count", as: "count" },
          { op: "sum", field: "budget", as: "budget" },
          { op: "avg", field: "progress", as: "progress" },
        ],
      }),
      serverApi.aggregate("project", {
        measures: [
          { op: "count", as: "count" },
          { op: "sum", field: "budget", as: "budget" },
          { op: "avg", field: "progress", as: "progress" },
        ],
      }),
    ]);
  } catch {
    /* no read access */
  }

  const totalRow = totals[0];
  const totalCount = num(totalRow?.measures.count);
  const totalBudget = num(totalRow?.measures.budget);
  const avgProgress = Math.round(num(totalRow?.measures.progress));
  const active = num(byStatus.find((r) => r.key === "active")?.measures.count);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Project Reports</h1>
          <p className="text-xs text-muted">Status mix, progress and budgets</p>
        </div>
        <Link href="/reports" className="text-xs font-medium text-primary hover:underline">
          ← All reports
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Projects" value={String(totalCount)} />
        <Stat label="Active" value={String(active)} />
        <Stat label="Avg progress" value={`${avgProgress}%`} />
        <Stat label="Total budget" value={formatMoney(totalBudget)} />
      </div>

      <Card>
        <CardHeader title="By status" />
        <CardBody className="p-0">
          <Table>
            <THead>
              <tr>
                <TH>Status</TH>
                <TH>Projects</TH>
                <TH>Avg progress</TH>
                <TH>Budget</TH>
              </tr>
            </THead>
            <tbody>
              {byStatus.length === 0 ? (
                <TR>
                  <TD>No data</TD>
                  <TD>—</TD>
                  <TD>—</TD>
                  <TD>—</TD>
                </TR>
              ) : (
                byStatus.map((r) => (
                  <TR key={r.key ?? "—"}>
                    <TD>
                      <Badge tone={enumTone(statusField, r.key)}>{statusLabel.get(r.key ?? "") ?? r.key ?? "—"}</Badge>
                    </TD>
                    <TD>{num(r.measures.count)}</TD>
                    <TD>{`${Math.round(num(r.measures.progress))}%`}</TD>
                    <TD>{formatMoney(num(r.measures.budget))}</TD>
                  </TR>
                ))
              )}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <div className="text-xs text-muted">{label}</div>
        <div className="mt-1 text-xl font-semibold">{value}</div>
      </CardBody>
    </Card>
  );
}
