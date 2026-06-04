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

export default async function RevenueReportsPage() {
  const statusField = metadata.getEntity("invoice").fields.find((f) => f.name === "status")!;
  const methodField = metadata.getEntity("payment").fields.find((f) => f.name === "method")!;
  const statusLabel = new Map((statusField.options ?? []).map((o) => [o.value, o.label] as const));
  const methodLabel = new Map((methodField.options ?? []).map((o) => [o.value, o.label] as const));

  let byStatus: AggregateRow[] = [];
  let byMethod: AggregateRow[] = [];
  let collectedRows: AggregateRow[] = [];
  try {
    [byStatus, byMethod, collectedRows] = await Promise.all([
      serverApi.aggregate("invoice", {
        groupBy: "status",
        measures: [
          { op: "count", as: "count" },
          { op: "sum", field: "total", as: "total" },
          { op: "sum", field: "balance", as: "balance" },
        ],
      }),
      serverApi.aggregate("payment", {
        groupBy: "method",
        measures: [
          { op: "count", as: "count" },
          { op: "sum", field: "amount", as: "amount" },
        ],
      }),
      serverApi.aggregate("payment", { measures: [{ op: "sum", field: "amount", as: "amount" }] }),
    ]);
  } catch {
    /* no read access */
  }

  const invoicedTotal = byStatus.reduce((s, r) => s + num(r.measures.total), 0);
  const outstanding = byStatus.reduce((s, r) => s + num(r.measures.balance), 0);
  const collected = collectedRows.reduce((s, r) => s + num(r.measures.amount), 0);
  const paidTotal = num(byStatus.find((r) => r.key === "paid")?.measures.total);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Revenue Reports</h1>
          <p className="text-xs text-muted">Invoiced amounts and cash collected</p>
        </div>
        <Link href="/reports" className="text-xs font-medium text-primary hover:underline">
          ← All reports
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Invoiced" value={formatMoney(invoicedTotal)} />
        <Stat label="Paid invoices" value={formatMoney(paidTotal)} />
        <Stat label="Collected" value={formatMoney(collected)} />
        <Stat label="Outstanding" value={formatMoney(outstanding)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Invoices by status" />
          <CardBody className="p-0">
            <Table>
              <THead>
                <tr>
                  <TH>Status</TH>
                  <TH>Count</TH>
                  <TH>Total</TH>
                  <TH>Balance</TH>
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
                      <TD>{formatMoney(num(r.measures.total))}</TD>
                      <TD>{formatMoney(num(r.measures.balance))}</TD>
                    </TR>
                  ))
                )}
              </tbody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Payments collected by method" />
          <CardBody className="p-0">
            <Table>
              <THead>
                <tr>
                  <TH>Method</TH>
                  <TH>Payments</TH>
                  <TH>Amount</TH>
                </tr>
              </THead>
              <tbody>
                {byMethod.length === 0 ? (
                  <TR>
                    <TD>No data</TD>
                    <TD>—</TD>
                    <TD>—</TD>
                  </TR>
                ) : (
                  byMethod.map((r) => (
                    <TR key={r.key ?? "—"}>
                      <TD>
                        <Badge tone={enumTone(methodField, r.key)}>{methodLabel.get(r.key ?? "") ?? r.key ?? "—"}</Badge>
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
