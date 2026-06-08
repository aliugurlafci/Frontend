import Link from "next/link";
import { getServerContext } from "@/lib/http/server-context";
import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { permissionEngine } from "@/lib/permissions/engine";
import { formatMoney } from "@/lib/finance/money";
import { getLocale } from "@/lib/i18n/server";
import { entityLabel } from "@/lib/i18n/labels";
import { t } from "@/lib/i18n/messages";
import { Badge } from "@/components/ui/badge";
import { enumTone } from "@/components/crm/field-format";
import { DocList } from "@/components/crm/doc-list";
import type { EntityRecord } from "@/lib/metadata/types";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderListPage() {
  const ctx = await getServerContext();
  const locale = await getLocale();
  const entity = metadata.getEntity("purchaseOrder");
  const statusField = entity.fields.find((f) => f.name === "status")!;
  const canCreate = permissionEngine.can(ctx, { action: "purchaseOrder:create", entity: "purchaseOrder" });

  let rows: EntityRecord[] = [];
  const supplierName = new Map<string, string>();
  try {
    const [po, sup] = await Promise.all([
      serverApi.list("purchaseOrder", { pageSize: 200, sort: [{ field: "number", dir: "desc" }] }),
      serverApi.list("supplier", { pageSize: 200 }),
    ]);
    rows = po.items;
    for (const s of sup.items) supplierName.set(s.id, String(s.name));
  } catch {
    /* no access */
  }

  return (
    <DocList
      title={entityLabel(entity, locale, { plural: true })}
      subtitle={`${rows.length} ${entityLabel(entity, locale, { plural: true })}`}
      newHref="/purchaseOrder/new"
      newLabel={`${t(locale, "common.new")} ${entityLabel(entity, locale)}`}
      canCreate={canCreate}
      icon="order"
      emptyTitle="No purchase orders yet"
      emptyDesc="Create a purchase order to restock from a supplier."
      rows={rows}
      columns={[
        { header: "Number", cell: (r) => <Link href={`/purchaseOrder/${r.id}`} className="font-medium text-primary hover:underline">{String(r.number ?? "—")}</Link> },
        { header: "Supplier", cell: (r) => supplierName.get(String(r.supplierId)) ?? "—" },
        { header: "Status", cell: (r) => <Badge tone={enumTone(statusField, r.status)}>{String(r.status)}</Badge> },
        { header: "Total", cell: (r) => formatMoney(typeof r.total === "number" ? r.total : 0, String(r.currencyCode ?? "USD")) },
        { header: "Order Date", cell: (r) => (r.orderDate ? new Date(String(r.orderDate)).toLocaleDateString() : "—") },
      ]}
    />
  );
}
