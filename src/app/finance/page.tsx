import { serverApi } from "@/lib/http/server-api";
import { formatMoney } from "@/lib/finance/money";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { PipelineBarChart, type ChartDatum } from "@/components/crm/dashboard-charts";
import { RunRecurringButton } from "@/components/crm/run-recurring-button";

export const dynamic = "force-dynamic";

const usd = (n: number) => formatMoney(n, "USD");
const DAY = 86_400_000;

function monthlyAmount(amount: number, frequency: string): number {
  if (frequency === "weekly") return (amount * 52) / 12;
  if (frequency === "quarterly") return amount / 3;
  if (frequency === "yearly") return amount / 12;
  return amount;
}

export default async function FinancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const todayMs = new Date(today).getTime();

  const [invoices, plans, accounts] = await Promise.all([
    serverApi.list("invoice", { pageSize: 500, sort: [{ field: "number", dir: "desc" }] }),
    serverApi.list("recurringPlan", { pageSize: 200 }),
    serverApi.list("account", { pageSize: 200 }),
  ]);
  const accountName = new Map(accounts.items.map((a) => [a.id, String(a.name)]));

  let outstanding = 0;
  let overdue = 0;
  let collected = 0;
  const aging = { current: 0, d30: 0, d60: 0, d60plus: 0 };

  for (const inv of invoices.items) {
    const balance = typeof inv.balance === "number" ? inv.balance : 0;
    collected += typeof inv.amountPaid === "number" ? inv.amountPaid : 0;
    const status = String(inv.status);
    if (status === "paid" || status === "void" || balance <= 0) continue;
    outstanding += balance;
    const due = inv.dueDate ? new Date(String(inv.dueDate)).getTime() : todayMs;
    const daysLate = Math.floor((todayMs - due) / DAY);
    if (daysLate > 0) overdue += balance;
    if (daysLate <= 0) aging.current += balance;
    else if (daysLate <= 30) aging.d30 += balance;
    else if (daysLate <= 60) aging.d60 += balance;
    else aging.d60plus += balance;
  }

  const mrr = plans.items
    .filter((p) => p.active)
    .reduce((s, p) => s + monthlyAmount(typeof p.amount === "number" ? p.amount : 0, String(p.frequency)), 0);

  const agingData: ChartDatum[] = [
    { label: "Current", value: Math.round(aging.current), color: "var(--success)" },
    { label: "1–30", value: Math.round(aging.d30), color: "var(--info)" },
    { label: "31–60", value: Math.round(aging.d60), color: "var(--warning)" },
    { label: "60+", value: Math.round(aging.d60plus), color: "var(--danger)" },
  ];

  const stats = [
    { label: "Outstanding", value: usd(outstanding) },
    { label: "Overdue", value: usd(overdue) },
    { label: "Collected", value: usd(collected) },
    { label: "MRR", value: usd(Math.round(mrr)) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Finance</h1>
          <p className="text-xs text-muted">Accounts receivable overview</p>
        </div>
        <RunRecurringButton />
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
          <CardHeader title="AR aging" />
          <CardBody>
            <PipelineBarChart data={agingData} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Recent invoices" />
          <Table>
            <THead>
              <tr>
                <TH>Number</TH>
                <TH>Account</TH>
                <TH>Status</TH>
                <TH>Balance</TH>
              </tr>
            </THead>
            <tbody>
              {invoices.items.slice(0, 6).map((inv) => (
                <TR key={inv.id}>
                  <TD>{String(inv.number ?? "—")}</TD>
                  <TD>{accountName.get(String(inv.accountId)) ?? "—"}</TD>
                  <TD>
                    <Badge tone={inv.status === "paid" ? "success" : inv.status === "overdue" ? "danger" : "info"}>
                      {String(inv.status)}
                    </Badge>
                  </TD>
                  <TD>{usd(typeof inv.balance === "number" ? inv.balance : 0)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
