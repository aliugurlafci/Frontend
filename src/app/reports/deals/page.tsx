import Link from "next/link";
import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import type { AggregateRow } from "@/lib/data/query";
import type { EntityRecord } from "@/lib/metadata/types";
import { formatMoney } from "@/lib/finance/money";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { enumTone } from "@/components/crm/field-format";

export const dynamic = "force-dynamic";

function num(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

export default async function DealReportsPage() {
  const stageField = metadata.getEntity("deal").fields.find((f) => f.name === "stage")!;
  const stageLabel = new Map((stageField.options ?? []).map((o) => [o.value, o.label] as const));

  let byStage: AggregateRow[] = [];
  let deals: EntityRecord[] = [];
  const accountName = new Map<string, string>();
  try {
    const [agg, list, accounts] = await Promise.all([
      serverApi.aggregate("deal", {
        groupBy: "stage",
        measures: [
          { op: "count", as: "count" },
          { op: "sum", field: "amount", as: "amount" },
        ],
      }),
      serverApi.list("deal", { pageSize: 200, sort: [{ field: "amount", dir: "desc" }] }),
      serverApi.list("account", { pageSize: 200 }),
    ]);
    byStage = agg;
    deals = list.items;
    for (const a of accounts.items) accountName.set(a.id, String(a.name));
  } catch {
    /* no read access */
  }

  const totalCount = byStage.reduce((s, r) => s + num(r.measures.count), 0);
  const totalAmount = byStage.reduce((s, r) => s + num(r.measures.amount), 0);
  const wonAmount = num(byStage.find((r) => r.key === "won")?.measures.amount);
  const openAmount = byStage
    .filter((r) => r.key !== "won" && r.key !== "lost")
    .reduce((s, r) => s + num(r.measures.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Deal Reports</h1>
          <p className="text-xs text-muted">Pipeline broken down by stage</p>
        </div>
        <Link href="/reports" className="text-xs font-medium text-primary hover:underline">
          ← All reports
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total deals" value={String(totalCount)} />
        <Stat label="Total value" value={formatMoney(totalAmount)} />
        <Stat label="Open pipeline" value={formatMoney(openAmount)} />
        <Stat label="Won value" value={formatMoney(wonAmount)} />
      </div>

      <Card>
        <CardHeader title="By stage" />
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

      <Card>
        <CardHeader title="Deals" />
        <CardBody className="p-0">
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Account</TH>
                <TH>Stage</TH>
                <TH>Amount</TH>
                <TH>Close date</TH>
              </tr>
            </THead>
            <tbody>
              {deals.length === 0 ? (
                <TR>
                  <TD>No deals</TD>
                  <TD>—</TD>
                  <TD>—</TD>
                  <TD>—</TD>
                  <TD>—</TD>
                </TR>
              ) : (
                deals.map((d) => (
                  <TR key={d.id}>
                    <TD>{String(d.name ?? "—")}</TD>
                    <TD>{accountName.get(String(d.accountId)) ?? "—"}</TD>
                    <TD>
                      <Badge tone={enumTone(stageField, d.stage)}>
                        {stageLabel.get(String(d.stage ?? "")) ?? String(d.stage ?? "—")}
                      </Badge>
                    </TD>
                    <TD>{formatMoney(num(d.amount))}</TD>
                    <TD>{d.closeDate ? new Date(String(d.closeDate)).toLocaleDateString() : "—"}</TD>
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
