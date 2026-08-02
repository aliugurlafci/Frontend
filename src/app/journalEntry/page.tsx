import Link from "next/link";
import { getServerContext } from "@/lib/http/server-context";
import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { permissionEngine } from "@/lib/permissions/engine";
import { formatMoney } from "@/lib/finance/money";
import { getLocale } from "@/lib/i18n/server";
import { entityLabel, enumLabel, fieldLabel } from "@/lib/i18n/labels";
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
  const sourceField = entity.fields.find((f) => f.name === "source")!;
  const canCreate = permissionEngine.can(ctx, { action: "journalEntry:create", entity: "journalEntry" });
  const fl = (name: string) => fieldLabel(entity.fields.find((f) => f.name === name)!, locale, "journalEntry");

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
      emptyTitle={t(locale, "doc.empty.journalEntry")}
      emptyDesc={t(locale, "doc.empty.journalEntry.desc")}
      rows={rows}
      columns={[
        { header: fl("number"), cell: (r) => <Link href={`/journalEntry/${r.id}`} className="font-medium text-primary hover:underline">{String(r.number ?? "—")}</Link> },
        { header: fl("date"), cell: (r) => (r.date ? new Date(String(r.date)).toLocaleDateString(locale) : "—") },
        { header: fl("source"), cell: (r) => enumLabel(sourceField, String(r.source ?? "manual"), locale) },
        { header: fl("status"), cell: (r) => <Badge tone={enumTone(statusField, r.status)}>{enumLabel(statusField, String(r.status ?? ""), locale)}</Badge> },
        { header: fl("debitTotal"), cell: (r) => formatMoney(typeof r.debitTotal === "number" ? r.debitTotal : 0, "USD") },
      ]}
    />
  );
}
