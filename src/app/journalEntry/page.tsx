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

export default async function JournalEntryListPage() {
  const ctx = await getServerContext();
  const locale = await getLocale();
  const entity = metadata.getEntity("journalEntry");
  const statusField = entity.fields.find((f) => f.name === "status")!;
  const canCreate = permissionEngine.can(ctx, { action: "journalEntry:create", entity: "journalEntry" });

  let rows: EntityRecord[] = [];
  try {
    const je = await serverApi.list("journalEntry", { pageSize: 200, sort: [{ field: "number", dir: "desc" }] });
    rows = je.items;
  } catch {
    /* no access */
  }

  return (
    <DocList
      title={entityLabel(entity, locale, { plural: true })}
      subtitle={`${rows.length} ${entityLabel(entity, locale, { plural: true })}`}
      newHref="/journalEntry/new"
      newLabel={`${t(locale, "common.new")} ${entityLabel(entity, locale)}`}
      canCreate={canCreate}
      icon="journal"
      emptyTitle="No journal entries yet"
      emptyDesc="Post a manual double-entry adjustment to the general ledger."
      rows={rows}
      columns={[
        { header: "Number", cell: (r) => <Link href={`/journalEntry/${r.id}`} className="font-medium text-primary hover:underline">{String(r.number ?? "—")}</Link> },
        { header: "Date", cell: (r) => (r.date ? new Date(String(r.date)).toLocaleDateString() : "—") },
        { header: "Source", cell: (r) => String(r.source ?? "manual") },
        { header: "Status", cell: (r) => <Badge tone={enumTone(statusField, r.status)}>{String(r.status)}</Badge> },
        { header: "Debit", cell: (r) => formatMoney(typeof r.debitTotal === "number" ? r.debitTotal : 0, "USD") },
      ]}
    />
  );
}
