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

export default async function QuoteListPage() {
  const ctx = await getServerContext();
  const statusField = metadata.getEntity("quote").fields.find((f) => f.name === "status")!;
  const canCreate = permissionEngine.can(ctx, { action: "quote:create", entity: "quote" });

  let quotes: Awaited<ReturnType<typeof serverApi.list>>["items"] = [];
  const accountName = new Map<string, string>();
  try {
    const [q, accounts] = await Promise.all([
      serverApi.list("quote", { pageSize: 200, sort: [{ field: "number", dir: "desc" }] }),
      serverApi.list("account", { pageSize: 200 }),
    ]);
    quotes = q.items;
    for (const a of accounts.items) accountName.set(a.id, String(a.name));
  } catch {
    /* no read access */
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Quotes</h1>
          <p className="text-xs text-muted">{quotes.length} quotes</p>
        </div>
        {canCreate && (
          <Link href="/quote/new">
            <Button variant="primary" size="sm">
              New Quote
            </Button>
          </Link>
        )}
      </div>

      <Card className="overflow-hidden">
        {quotes.length === 0 ? (
          <EmptyState icon="quote" title="No quotes yet" description="Create your first quote to get started." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Number</TH>
                <TH>Account</TH>
                <TH>Status</TH>
                <TH>Total</TH>
                <TH>Valid Until</TH>
              </tr>
            </THead>
            <tbody>
              {quotes.map((q) => (
                <TR key={q.id} onClick={undefined}>
                  <TD>
                    <Link href={`/quote/${q.id}`} className="font-medium text-primary hover:underline">
                      {String(q.number ?? "—")}
                    </Link>
                  </TD>
                  <TD>{accountName.get(String(q.accountId)) ?? "—"}</TD>
                  <TD>
                    <Badge tone={enumTone(statusField, q.status)}>{String(q.status)}</Badge>
                  </TD>
                  <TD>{formatMoney(typeof q.total === "number" ? q.total : 0, String(q.currencyCode ?? "USD"))}</TD>
                  <TD>{q.validUntil ? new Date(String(q.validUntil)).toLocaleDateString() : "—"}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
