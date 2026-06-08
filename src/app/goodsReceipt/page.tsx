import Link from "next/link";
import { getServerContext } from "@/lib/http/server-context";
import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { permissionEngine } from "@/lib/permissions/engine";
import { getLocale } from "@/lib/i18n/server";
import { entityLabel } from "@/lib/i18n/labels";
import { t } from "@/lib/i18n/messages";
import { Badge } from "@/components/ui/badge";
import { DocList } from "@/components/crm/doc-list";
import type { EntityRecord } from "@/lib/metadata/types";

export const dynamic = "force-dynamic";

export default async function GoodsReceiptListPage() {
  const ctx = await getServerContext();
  const locale = await getLocale();
  const entity = metadata.getEntity("goodsReceipt");
  const canCreate = permissionEngine.can(ctx, { action: "goodsReceipt:create", entity: "goodsReceipt" });

  let rows: EntityRecord[] = [];
  const supplierName = new Map<string, string>();
  const warehouseName = new Map<string, string>();
  try {
    const [grns, sup, wh] = await Promise.all([
      serverApi.list("goodsReceipt", { pageSize: 200, sort: [{ field: "number", dir: "desc" }] }),
      serverApi.list("supplier", { pageSize: 200 }),
      serverApi.list("warehouse", { pageSize: 200 }),
    ]);
    rows = grns.items;
    for (const s of sup.items) supplierName.set(s.id, String(s.name));
    for (const w of wh.items) warehouseName.set(w.id, String(w.name));
  } catch {
    /* no access */
  }

  return (
    <DocList
      title={entityLabel(entity, locale, { plural: true })}
      subtitle={`${rows.length} ${entityLabel(entity, locale, { plural: true })}`}
      newHref="/goodsReceipt/new"
      newLabel={`${t(locale, "common.new")} ${entityLabel(entity, locale)}`}
      canCreate={canCreate}
      icon="stock"
      emptyTitle="No goods receipts yet"
      emptyDesc="Receive stock into a warehouse and post it to inventory."
      rows={rows}
      columns={[
        { header: "Number", cell: (r) => <Link href={`/goodsReceipt/${r.id}`} className="font-medium text-primary hover:underline">{String(r.number ?? "—")}</Link> },
        { header: "Supplier", cell: (r) => supplierName.get(String(r.supplierId)) ?? "—" },
        { header: "Warehouse", cell: (r) => warehouseName.get(String(r.warehouseId)) ?? "—" },
        { header: "Status", cell: (r) => <Badge tone={r.status === "posted" ? "success" : r.status === "void" ? "danger" : "neutral"}>{String(r.status)}</Badge> },
        { header: "Date", cell: (r) => (r.receiptDate ? new Date(String(r.receiptDate)).toLocaleDateString() : "—") },
      ]}
    />
  );
}
