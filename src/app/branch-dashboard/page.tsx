import { serverApi } from "@/lib/http/server-api";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import type { AggregateRow } from "@/lib/data/query";
import type { EntityRecord } from "@/lib/metadata/types";

export const dynamic = "force-dynamic";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default async function BranchDashboardPage() {
  let branches: EntityRecord[] = [];
  let sales: AggregateRow[] = [];
  let stock: AggregateRow[] = [];
  try {
    branches = (await serverApi.list("branch", { pageSize: 200 })).items;
  } catch {
    branches = [];
  }
  try {
    sales = await serverApi.aggregate("invoice", {
      groupBy: "branchId",
      measures: [{ op: "sum", field: "total", as: "total" }, { op: "sum", field: "balance", as: "balance" }],
    });
  } catch {
    sales = [];
  }
  try {
    stock = await serverApi.aggregate("stockMovement", {
      groupBy: "branchId",
      measures: [{ op: "sum", field: "value", as: "value" }],
    });
  } catch {
    stock = [];
  }

  const salesBy = new Map(sales.map((r) => [String(r.key), r.measures]));
  const stockBy = new Map(stock.map((r) => [String(r.key), r.measures]));
  const rows = branches.map((b) => {
    const s = salesBy.get(String(b.id)) ?? {};
    const st = stockBy.get(String(b.id)) ?? {};
    return {
      id: String(b.id),
      name: String(b.name ?? ""),
      code: String(b.code ?? ""),
      sales: Math.round(s.total ?? 0),
      ar: Math.round(s.balance ?? 0),
      stock: Math.round(st.value ?? 0),
    };
  });

  const stats = [
    { label: "Branches", value: String(rows.length) },
    { label: "Total invoiced", value: money(rows.reduce((s, r) => s + r.sales, 0)) },
    { label: "Outstanding AR", value: money(rows.reduce((s, r) => s + r.ar, 0)) },
    { label: "Stock value", value: money(rows.reduce((s, r) => s + r.stock, 0)) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Branch Dashboard</h1>
        <p className="text-xs text-muted">Per-branch sales, receivables and stock value.</p>
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
        <CardHeader title="Performance by branch" />
        <Table>
          <THead>
            <tr>
              <TH>Code</TH>
              <TH>Branch</TH>
              <TH>Invoiced</TH>
              <TH>Outstanding AR</TH>
              <TH>Stock value</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD>{r.code}</TD>
                <TD>{r.name}</TD>
                <TD><span className="tabular-nums">{money(r.sales)}</span></TD>
                <TD><span className="tabular-nums">{money(r.ar)}</span></TD>
                <TD><span className="tabular-nums">{money(r.stock)}</span></TD>
              </TR>
            ))}
            {rows.length === 0 && (
              <TR>
                <TD>No branches yet.</TD>
              </TR>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
