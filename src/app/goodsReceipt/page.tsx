import Link from "next/link";
import { getServerContext } from "@/lib/http/server-context";
import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { permissionEngine } from "@/lib/permissions/engine";
import { formatMoney } from "@/lib/finance/money";
import { getLocale } from "@/lib/i18n/server";
import { entityLabel, enumLabel, fieldLabel } from "@/lib/i18n/labels";
import { t } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { enumTone } from "@/components/crm/field-format";
import type { EntityRecord } from "@/lib/metadata/types";

export const dynamic = "force-dynamic";

/** Purchase-order states that still have stock to receive. */
const RECEIVABLE = new Set(["approved", "partial"]);

/**
 * Goods receipts screen.
 *
 * Receiving always starts from an approved purchase order, so the default tab
 * lists the orders still awaiting stock — opening one goes straight into the
 * receipt entry for it. The second tab is the archive of receipts already
 * recorded. There is no free-standing "new receipt" action.
 */
export default async function GoodsReceiptListPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const showHistory = tab === "history";

  const ctx = await getServerContext();
  const locale = await getLocale();
  const grnEntity = metadata.getEntity("goodsReceipt");
  const poEntity = metadata.getEntity("purchaseOrder");
  const poStatusField = poEntity.fields.find((f) => f.name === "status")!;
  const grnStatusField = grnEntity.fields.find((f) => f.name === "status")!;
  const canReceive = permissionEngine.can(ctx, { action: "goodsReceipt:create", entity: "goodsReceipt" });

  const poField = (name: string) => fieldLabel(poEntity.fields.find((f) => f.name === name)!, locale, "purchaseOrder");
  const grnField = (name: string) => fieldLabel(grnEntity.fields.find((f) => f.name === name)!, locale, "goodsReceipt");

  let pendingOrders: EntityRecord[] = [];
  let receipts: EntityRecord[] = [];
  const supplierName = new Map<string, string>();
  const warehouseName = new Map<string, string>();
  try {
    const [orders, grns, sup, wh] = await Promise.all([
      serverApi.list("purchaseOrder", { pageSize: 200, sort: [{ field: "number", dir: "desc" }] }),
      serverApi.list("goodsReceipt", { pageSize: 200, sort: [{ field: "number", dir: "desc" }] }),
      serverApi.list("supplier", { pageSize: 200 }),
      serverApi.list("warehouse", { pageSize: 200 }),
    ]);
    // The list query string can't express an `in` filter, so narrow here.
    pendingOrders = orders.items.filter((p) => RECEIVABLE.has(String(p.status)));
    receipts = grns.items;
    for (const s of sup.items) supplierName.set(s.id, String(s.name));
    for (const w of wh.items) warehouseName.set(w.id, String(w.name));
  } catch {
    /* no access */
  }

  const tabs = [
    { key: "pending", label: t(locale, "grn.tabPending"), count: pendingOrders.length, href: "/goodsReceipt" },
    { key: "history", label: t(locale, "grn.tabHistory"), count: receipts.length, href: "/goodsReceipt?tab=history" },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold">{entityLabel(grnEntity, locale, { plural: true })}</h1>
        <p className="text-xs text-muted">{t(locale, "grn.subtitle")}</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((tabDef) => {
          const active = tabDef.key === (showHistory ? "history" : "pending");
          return (
            <Link
              key={tabDef.key}
              href={tabDef.href}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted hover:border-border-strong hover:text-foreground",
              )}
            >
              {tabDef.label}
              <span className="ml-1.5 text-xs tabular-nums text-muted-2">{tabDef.count}</span>
            </Link>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        {showHistory ? (
          receipts.length === 0 ? (
            <EmptyState icon="stock" title={t(locale, "grn.emptyHistory")} description={t(locale, "grn.emptyHistoryDesc")} />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>{grnField("number")}</TH>
                  <TH>{grnField("supplierId")}</TH>
                  <TH>{grnField("warehouseId")}</TH>
                  <TH>{grnField("status")}</TH>
                  <TH>{grnField("receiptDate")}</TH>
                </tr>
              </THead>
              <tbody>
                {receipts.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/goodsReceipt/${r.id}`} className="font-medium text-primary hover:underline">
                        {String(r.number ?? "—")}
                      </Link>
                    </TD>
                    <TD>{supplierName.get(String(r.supplierId)) ?? "—"}</TD>
                    <TD>{warehouseName.get(String(r.warehouseId)) ?? "—"}</TD>
                    <TD>
                      <Badge tone={enumTone(grnStatusField, r.status)}>
                        {enumLabel(grnStatusField, String(r.status ?? ""), locale)}
                      </Badge>
                    </TD>
                    <TD>{r.receiptDate ? new Date(String(r.receiptDate)).toLocaleDateString(locale) : "—"}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )
        ) : pendingOrders.length === 0 ? (
          <EmptyState icon="order" title={t(locale, "grn.emptyPending")} description={t(locale, "grn.emptyPendingDesc")} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>{poField("number")}</TH>
                <TH>{poField("supplierId")}</TH>
                <TH>{poField("status")}</TH>
                <TH>{poField("total")}</TH>
                <TH>{poField("orderDate")}</TH>
                <TH>{t(locale, "common.actions")}</TH>
              </tr>
            </THead>
            <tbody>
              {pendingOrders.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/purchaseOrder/${p.id}`} className="font-medium text-primary hover:underline">
                      {String(p.number ?? "—")}
                    </Link>
                  </TD>
                  <TD>{supplierName.get(String(p.supplierId)) ?? "—"}</TD>
                  <TD>
                    <Badge tone={enumTone(poStatusField, p.status)}>
                      {enumLabel(poStatusField, String(p.status ?? ""), locale)}
                    </Badge>
                  </TD>
                  <TD>{formatMoney(typeof p.total === "number" ? p.total : 0, String(p.currencyCode ?? "USD"))}</TD>
                  <TD>{p.orderDate ? new Date(String(p.orderDate)).toLocaleDateString(locale) : "—"}</TD>
                  <TD>
                    {canReceive ? (
                      <Link
                        href={`/goodsReceipt/new?po=${encodeURIComponent(String(p.id))}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {t(locale, "grn.receive")}
                      </Link>
                    ) : (
                      <span className="text-muted-2">—</span>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
