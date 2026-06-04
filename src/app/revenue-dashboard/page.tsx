import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { ValueCell } from "@/components/crm/value-cell";
import type { EntityRecord } from "@/lib/metadata/types";

export const dynamic = "force-dynamic";

const usd = (n: number) => "$" + Math.round(n).toLocaleString();

export default async function RevenueDashboardPage() {
  const invoiceEntity = metadata.getEntity("invoice");
  const numberField = invoiceEntity.fields.find((f) => f.name === "number")!;
  const statusField = invoiceEntity.fields.find((f) => f.name === "status")!;
  const totalField = invoiceEntity.fields.find((f) => f.name === "total")!;
  const balanceField = invoiceEntity.fields.find((f) => f.name === "balance")!;
  const dueField = invoiceEntity.fields.find((f) => f.name === "dueDate")!;

  let invoices: EntityRecord[] = [];
  try {
    const res = await serverApi.list("invoice", { pageSize: 500, sort: [{ field: "dueDate", dir: "desc" }] });
    invoices = res.items;
  } catch {
    invoices = [];
  }

  let payments: EntityRecord[] = [];
  try {
    const res = await serverApi.list("payment", { pageSize: 500 });
    payments = res.items;
  } catch {
    payments = [];
  }

  let invoicedTotal = 0;
  let outstanding = 0;
  let overdueCount = 0;
  for (const inv of invoices) {
    invoicedTotal += typeof inv.total === "number" ? inv.total : 0;
    outstanding += typeof inv.balance === "number" ? inv.balance : 0;
    if (inv.status === "overdue") overdueCount += 1;
  }
  const collected = payments.reduce(
    (sum, p) => sum + (typeof p.amount === "number" ? p.amount : 0),
    0,
  );

  const stats = [
    { label: "Invoiced", value: usd(invoicedTotal) },
    { label: "Collected", value: usd(collected) },
    { label: "Outstanding", value: usd(outstanding) },
    { label: "Overdue", value: String(overdueCount) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Revenue Summary</h1>
        <p className="text-xs text-muted">Billing, collections and outstanding receivables.</p>
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
        <CardHeader title="Recent invoices" />
        <Table>
          <THead>
            <tr>
              <TH>Number</TH>
              <TH>Status</TH>
              <TH>Total</TH>
              <TH>Balance</TH>
              <TH>Due Date</TH>
            </tr>
          </THead>
          <tbody>
            {invoices.slice(0, 10).map((inv) => (
              <TR key={inv.id}>
                <TD>
                  <ValueCell field={numberField} value={inv.number ?? null} />
                </TD>
                <TD>
                  <ValueCell field={statusField} value={inv.status ?? null} />
                </TD>
                <TD>
                  <ValueCell field={totalField} value={inv.total ?? null} />
                </TD>
                <TD>
                  <ValueCell field={balanceField} value={inv.balance ?? null} />
                </TD>
                <TD>
                  <ValueCell field={dueField} value={inv.dueDate ?? null} />
                </TD>
              </TR>
            ))}
            {invoices.length === 0 && (
              <TR>
                <TD>No invoices.</TD>
              </TR>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
