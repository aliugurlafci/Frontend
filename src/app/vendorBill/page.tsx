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

export default async function VendorBillListPage() {
  const ctx = await getServerContext();
  const locale = await getLocale();
  const entity = metadata.getEntity("vendorBill");
  const statusField = entity.fields.find((f) => f.name === "status")!;
  const canCreate = permissionEngine.can(ctx, { action: "vendorBill:create", entity: "vendorBill" });

  let rows: EntityRecord[] = [];
  const supplierName = new Map<string, string>();
  try {
    const [bills, sup] = await Promise.all([
      serverApi.list("vendorBill", { pageSize: 200, sort: [{ field: "number", dir: "desc" }] }),
      serverApi.list("supplier", { pageSize: 200 }),
    ]);
    rows = bills.items;
    for (const s of sup.items) supplierName.set(s.id, String(s.name));
  } catch {
    /* no access */
  }

  return (
    <DocList
      title={entityLabel(entity, locale, { plural: true })}
      subtitle={`${rows.length} ${entityLabel(entity, locale, { plural: true })}`}
      newHref="/vendorBill/new"
      newLabel={`${t(locale, "common.new")} ${entityLabel(entity, locale)}`}
      canCreate={canCreate}
      icon="receipt"
      emptyTitle="No vendor bills yet"
      emptyDesc="Record a supplier bill (accounts payable)."
      rows={rows}
      columns={[
        { header: "Number", cell: (r) => <Link href={`/vendorBill/${r.id}`} className="font-medium text-primary hover:underline">{String(r.number ?? "—")}</Link> },
        { header: "Supplier", cell: (r) => supplierName.get(String(r.supplierId)) ?? "—" },
        { header: "Status", cell: (r) => <Badge tone={enumTone(statusField, r.status)}>{String(r.status)}</Badge> },
        { header: "Total", cell: (r) => formatMoney(typeof r.total === "number" ? r.total : 0, String(r.currencyCode ?? "USD")) },
        { header: "Balance", cell: (r) => formatMoney(typeof r.balance === "number" ? r.balance : 0, String(r.currencyCode ?? "USD")) },
      ]}
    />
  );
}
