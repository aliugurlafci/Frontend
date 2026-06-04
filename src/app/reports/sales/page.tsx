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

const OPEN_STAGES = ["lead", "qualified", "proposal", "negotiation"];

export default async function SalesReportsPage() {
  const stageField = metadata.getEntity("deal").fields.find((f) => f.name === "stage")!;
  const stageLabel = new Map((stageField.options ?? []).map((o) => [o.value, o.label] as const));

  let byStage: AggregateRow[] = [];
  try {
    byStage = await serverApi.aggregate("deal", {
      groupBy: "stage",
      measures: [
        { op: "count", as: "count" },
        { op: "sum", field: "amount", as: "amount" },
      ],
    });
  } catch {
    /* no read access */
  }

  const stageRow = (key: string) => byStage.find((r) => r.key === key);
  const wonAmount = num(stageRow("won")?.measures.amount);
  const wonCount = num(stageRow("won")?.measures.count);
  const lostCount = num(stageRow("lost")?.measures.count);
  const pipeline = byStage.filter((r) => OPEN_STAGES.includes(r.key ?? "")).reduce((s, r) => s + num(r.measures.amount), 0);
  const closedTotal = wonCount + lostCount;
  const winRate = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Sales Reports</h1>
          <p className="text-xs text-muted">Won revenue and open pipeline performance</p>
        </div>
        <Link href="/reports" className="text-xs font-medium text-primary hover:underline">
          ← All reports
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Won revenue" value={formatMoney(wonAmount)} />
        <Stat label="Won deals" value={String(wonCount)} />
        <Stat label="Open pipeline" value={formatMoney(pipeline)} />
        <Stat label="Win rate" value={`${winRate}%`} />
      </div>

      <Card>
        <CardHeader title="Performance by stage" />
        <CardBody className="p-0">
          <Table>
            <THead>
              <tr>
                <TH>Stage</TH>
                <TH>Deals</TH>
                <TH>Value</TH>
              </tr>
            </THead>
            <tbody>
              {byStage.length === 0 ? (
                <TR>
                  <TD>No data</TD>
                  <TD>—</TD>
                  <TD>—</TD>
                </TR>
              ) : (
                byStage.map((r) => (
                  <TR key={r.key ?? "—"}>
                    <TD>
                      <Badge tone={enumTone(stageField, r.key)}>{stageLabel.get(r.key ?? "") ?? r.key ?? "—"}</Badge>
                    </TD>
                    <TD>{num(r.measures.count)}</TD>
                    <TD>{formatMoney(num(r.measures.amount))}</TD>
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
