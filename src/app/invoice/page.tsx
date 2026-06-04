import Link from "next/link";
import { getServerContext } from "@/lib/http/server-context";
import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { permissionEngine } from "@/lib/permissions/engine";
import { formatMoney } from "@/lib/finance/money";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { enumTone } from "@/components/crm/field-format";

export const dynamic = "force-dynamic";

export default async function InvoiceListPage() {
  const ctx = await getServerContext();
  const statusField = metadata.getEntity("invoice").fields.find((f) => f.name === "status")!;
  const canCreate = permissionEngine.can(ctx, { action: "invoice:create", entity: "invoice" });

  let invoices: Awaited<ReturnType<typeof serverApi.list>>["items"] = [];
  const accountName = new Map<string, string>();
  try {
    const [inv, accounts] = await Promise.all([
      serverApi.list("invoice", { pageSize: 200, sort: [{ field: "number", dir: "desc" }] }),
      serverApi.list("account", { pageSize: 200 }),
    ]);
    invoices = inv.items;
    for (const a of accounts.items) accountName.set(a.id, String(a.name));
  } catch {
    /* no read access */
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Invoices</h1>
          <p className="text-xs text-muted">{invoices.length} invoices</p>
        </div>
        {canCreate && (
          <Link href="/invoice/new">
            <Button variant="primary" size="sm">
              New Invoice
            </Button>
          </Link>
        )}
      </div>

      <Card className="overflow-hidden">
        {invoices.length === 0 ? (
          <EmptyState icon="invoice" title="No invoices yet" description="Create an invoice or convert a quote." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Number</TH>
                <TH>Account</TH>
                <TH>Status</TH>
                <TH>Total</TH>
                <TH>Balance</TH>
                <TH>Due</TH>
              </tr>
            </THead>
            <tbody>
              {invoices.map((inv) => (
                <TR key={inv.id} onClick={undefined}>
                  <TD>
                    <Link href={`/invoice/${inv.id}`} className="font-medium text-primary hover:underline">
                      {String(inv.number ?? "—")}
                    </Link>
                  </TD>
                  <TD>{accountName.get(String(inv.accountId)) ?? "—"}</TD>
                  <TD>
                    <Badge tone={enumTone(statusField, inv.status)}>{String(inv.status)}</Badge>
                  </TD>
                  <TD>{formatMoney(typeof inv.total === "number" ? inv.total : 0, String(inv.currencyCode ?? "USD"))}</TD>
                  <TD>{formatMoney(typeof inv.balance === "number" ? inv.balance : 0, String(inv.currencyCode ?? "USD"))}</TD>
                  <TD>{inv.dueDate ? new Date(String(inv.dueDate)).toLocaleDateString() : "—"}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
