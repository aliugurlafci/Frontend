import { serverApi } from "@/lib/http/server-api";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import type { AggregateRow } from "@/lib/data/query";
import type { EntityRecord } from "@/lib/metadata/types";

export const dynamic = "force-dynamic";

export default async function InventoryDashboardPage() {
  let byProduct: AggregateRow[] = [];
  let products: EntityRecord[] = [];
  try {
    byProduct = await serverApi.aggregate("stockMovement", {
      groupBy: "productId",
      measures: [{ op: "sum", field: "qty", as: "qty" }, { op: "sum", field: "value", as: "value" }],
    });
  } catch {
    byProduct = [];
  }
  try {
    products = (await serverApi.list("product", { pageSize: 500 })).items;
  } catch {
    products = [];
  }

  const onHand = new Map(byProduct.map((r) => [String(r.key), r.measures]));
  const rows = products
    .filter((p) => p.trackStock)
    .map((p) => {
      const m = onHand.get(String(p.id)) ?? { qty: 0, value: 0 };
      return {
        id: String(p.id),
        name: String(p.name ?? ""),
        sku: String(p.sku ?? ""),
        onHand: Math.round(m.qty ?? 0),
        value: Math.round(m.value ?? 0),
        reorder: Number(p.reorderLevel ?? 0),
      };
    })
    .sort((a, b) => b.value - a.value);

  const totalUnits = rows.reduce((s, r) => s + r.onHand, 0);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const lowStock = rows.filter((r) => r.reorder > 0 && r.onHand <= r.reorder);

  const stats = [
    { label: "Tracked SKUs", value: String(rows.length) },
    { label: "Units on hand", value: totalUnits.toLocaleString() },
    { label: "Inventory value", value: `$${totalValue.toLocaleString()}` },
    { label: "Low stock", value: String(lowStock.length) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Inventory Dashboard</h1>
        <p className="text-xs text-muted">Stock on hand, valuation and reorder alerts.</p>
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
        <CardHeader title="Stock on hand by product" />
        <Table>
          <THead>
            <tr>
              <TH>Product</TH>
              <TH>SKU</TH>
              <TH>On hand</TH>
              <TH>Value</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD>{r.name}</TD>
                <TD>{r.sku}</TD>
                <TD><span className="tabular-nums">{r.onHand.toLocaleString()}</span></TD>
                <TD><span className="tabular-nums">${r.value.toLocaleString()}</span></TD>
                <TD>
                  {r.reorder > 0 && r.onHand <= r.reorder ? (
                    <Badge tone="danger">Low</Badge>
                  ) : (
                    <Badge tone="success">OK</Badge>
                  )}
                </TD>
              </TR>
            ))}
            {rows.length === 0 && (
              <TR>
                <TD>No stock-tracked products.</TD>
              </TR>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
