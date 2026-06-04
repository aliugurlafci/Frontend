import Link from "next/link";
import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import type { AggregateRow } from "@/lib/data/query";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { enumTone } from "@/components/crm/field-format";

export const dynamic = "force-dynamic";

function num(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

export default async function LeadReportsPage() {
  const sourceField = metadata.getEntity("lead").fields.find((f) => f.name === "source")!;
  const statusField = metadata.getEntity("lead").fields.find((f) => f.name === "status")!;
  const sourceLabel = new Map((sourceField.options ?? []).map((o) => [o.value, o.label] as const));
  const statusLabel = new Map((statusField.options ?? []).map((o) => [o.value, o.label] as const));

  let bySource: AggregateRow[] = [];
  let byStatus: AggregateRow[] = [];
  try {
    [bySource, byStatus] = await Promise.all([
      serverApi.aggregate("lead", {
        groupBy: "source",
        measures: [
          { op: "count", as: "count" },
          { op: "sum", field: "estimatedValue", as: "value" },
        ],
      }),
      serverApi.aggregate("lead", { groupBy: "status", measures: [{ op: "count", as: "count" }] }),
    ]);
  } catch {
    /* no read access */
  }

  const total = byStatus.reduce((s, r) => s + num(r.measures.count), 0);
  const qualified = num(byStatus.find((r) => r.key === "qualified")?.measures.count);
  const converted = num(byStatus.find((r) => r.key === "converted")?.measures.count);
  const convRate = total > 0 ? Math.round((converted / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Lead Reports</h1>
          <p className="text-xs text-muted">Funnel volume by source and status</p>
        </div>
        <Link href="/reports" className="text-xs font-medium text-primary hover:underline">
          ← All reports
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total leads" value={String(total)} />
        <Stat label="Qualified" value={String(qualified)} />
        <Stat label="Converted" value={String(converted)} />
        <Stat label="Conversion rate" value={`${convRate}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="By source" />
          <CardBody className="p-0">
            <Table>
              <THead>
                <tr>
                  <TH>Source</TH>
                  <TH>Leads</TH>
                  <TH>Est. value</TH>
                </tr>
              </THead>
              <tbody>
                {bySource.length === 0 ? (
                  <TR>
                    <TD>No data</TD>
                    <TD>—</TD>
                    <TD>—</TD>
                  </TR>
                ) : (
                  bySource.map((r) => (
                    <TR key={r.key ?? "—"}>
                      <TD>
                        <Badge tone={enumTone(sourceField, r.key)}>{sourceLabel.get(r.key ?? "") ?? r.key ?? "—"}</Badge>
                      </TD>
                      <TD>{num(r.measures.count)}</TD>
                      <TD>{"$" + Math.round(num(r.measures.value)).toLocaleString()}</TD>
                    </TR>
                  ))
                )}
              </tbody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="By status" />
          <CardBody className="p-0">
            <Table>
              <THead>
                <tr>
                  <TH>Status</TH>
                  <TH>Leads</TH>
                  <TH>Share</TH>
                </tr>
              </THead>
              <tbody>
                {byStatus.length === 0 ? (
                  <TR>
                    <TD>No data</TD>
                    <TD>—</TD>
                    <TD>—</TD>
                  </TR>
                ) : (
                  byStatus.map((r) => {
                    const c = num(r.measures.count);
                    return (
                      <TR key={r.key ?? "—"}>
                        <TD>
                          <Badge tone={enumTone(statusField, r.key)}>
                            {statusLabel.get(r.key ?? "") ?? r.key ?? "—"}
                          </Badge>
                        </TD>
                        <TD>{c}</TD>
                        <TD>{total > 0 ? `${Math.round((c / total) * 100)}%` : "—"}</TD>
                      </TR>
                    );
                  })
                )}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>
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
