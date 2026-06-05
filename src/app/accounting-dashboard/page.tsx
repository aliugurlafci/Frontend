import { serverApi } from "@/lib/http/server-api";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import type { AggregateRow } from "@/lib/data/query";
import type { EntityRecord } from "@/lib/metadata/types";

export const dynamic = "force-dynamic";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default async function AccountingDashboardPage() {
  let tb: AggregateRow[] = [];
  let accounts: EntityRecord[] = [];
  try {
    tb = await serverApi.aggregate("journalLine", {
      groupBy: "ledgerAccountId",
      filters: [{ field: "posted", op: "eq", value: true }],
      measures: [{ op: "sum", field: "debit", as: "debit" }, { op: "sum", field: "credit", as: "credit" }],
    });
  } catch {
    tb = [];
  }
  try {
    accounts = (await serverApi.list("ledgerAccount", { pageSize: 500 })).items;
  } catch {
    accounts = [];
  }

  const accById = new Map(accounts.map((a) => [String(a.id), a]));
  const rows = tb
    .filter((r) => r.key)
    .map((r) => {
      const a = accById.get(String(r.key));
      const debit = Math.round((r.measures.debit ?? 0) * 100) / 100;
      const credit = Math.round((r.measures.credit ?? 0) * 100) / 100;
      return {
        code: String(a?.code ?? ""),
        name: String(a?.name ?? r.key),
        type: String(a?.type ?? "other"),
        debit,
        credit,
        balance: Math.round((debit - credit) * 100) / 100,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const sumBy = (type: string, side: "debit" | "credit") =>
    rows.filter((r) => r.type === type).reduce((s, r) => s + (side === "debit" ? r.debit - r.credit : r.credit - r.debit), 0);

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const revenue = sumBy("revenue", "credit");
  const expense = sumBy("expense", "debit");
  const netIncome = revenue - expense;
  const assets = sumBy("asset", "debit");
  const liabilities = sumBy("liability", "credit");
  const equity = sumBy("equity", "credit");

  const stats = [
    { label: "Trial balance", value: totalDebit === totalCredit ? "Balanced" : "Out of balance" },
    { label: "Revenue", value: money(revenue) },
    { label: "Expenses", value: money(expense) },
    { label: "Net income", value: money(netIncome) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Accounting Dashboard</h1>
        <p className="text-xs text-muted">Trial balance, profit &amp; loss and balance sheet.</p>
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
          <CardHeader title="Profit & Loss" />
          <CardBody className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted">Revenue</span><span className="tabular-nums">{money(revenue)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Expenses</span><span className="tabular-nums">{money(expense)}</span></div>
            <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Net income</span><span className="tabular-nums">{money(netIncome)}</span></div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Balance Sheet" />
          <CardBody className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted">Assets</span><span className="tabular-nums">{money(assets)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Liabilities</span><span className="tabular-nums">{money(liabilities)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Equity + Net income</span><span className="tabular-nums">{money(equity + netIncome)}</span></div>
            <div className="flex justify-between border-t border-border pt-1 font-semibold">
              <span>Assets = L + E</span>
              <span className="tabular-nums">{money(assets)} = {money(liabilities + equity + netIncome)}</span>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Trial balance" />
        <Table>
          <THead>
            <tr>
              <TH>Code</TH>
              <TH>Account</TH>
              <TH>Debit</TH>
              <TH>Credit</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((r) => (
              <TR key={r.code + r.name}>
                <TD>{r.code}</TD>
                <TD>{r.name}</TD>
                <TD><span className="tabular-nums">{r.debit ? money(r.debit) : "—"}</span></TD>
                <TD><span className="tabular-nums">{r.credit ? money(r.credit) : "—"}</span></TD>
              </TR>
            ))}
            {rows.length > 0 && (
              <TR>
                <TD>{""}</TD>
                <TD>Total</TD>
                <TD><span className="tabular-nums font-semibold">{money(totalDebit)}</span></TD>
                <TD><span className="tabular-nums font-semibold">{money(totalCredit)}</span></TD>
              </TR>
            )}
            {rows.length === 0 && (
              <TR>
                <TD>No posted journal entries.</TD>
              </TR>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
