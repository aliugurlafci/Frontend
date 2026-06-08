import Link from "next/link";
import { getServerContext } from "@/lib/http/server-context";
import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { permissionEngine } from "@/lib/permissions/engine";
import { formatMoney } from "@/lib/finance/money";
import { getLocale } from "@/lib/i18n/server";
import { t as translate } from "@/lib/i18n/messages";
import { enumLabel } from "@/lib/i18n/labels";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { enumTone } from "@/components/crm/field-format";

export const dynamic = "force-dynamic";

export default async function QuoteListPage() {
  const ctx = await getServerContext();
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string>) => translate(locale, key, vars);
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
          <h1 className="text-lg font-semibold">{t("quoteList.title")}</h1>
          <p className="text-xs text-muted">{t("quoteList.count", { count: String(quotes.length) })}</p>
        </div>
        {canCreate && (
          <Link href="/quote/new">
            <Button variant="primary" size="sm">
              {t("quoteList.new")}
            </Button>
          </Link>
        )}
      </div>

      <Card className="overflow-hidden">
        {quotes.length === 0 ? (
          <EmptyState icon="quote" title={t("quoteList.empty")} description={t("quoteList.emptyDesc")} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>{t("quoteList.colNumber")}</TH>
                <TH>{t("quoteList.colAccount")}</TH>
                <TH>{t("quoteList.colStatus")}</TH>
                <TH>{t("quoteList.colTotal")}</TH>
                <TH>{t("quoteList.colValidUntil")}</TH>
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
                    <Badge tone={enumTone(statusField, q.status)}>{enumLabel(statusField, q.status as string, locale)}</Badge>
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
