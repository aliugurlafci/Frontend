import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import type { AggregateRow } from "@/lib/data/query";
import type { EntityRecord } from "@/lib/metadata/types";
import { getLocale } from "@/lib/i18n/server";
import { t as translate } from "@/lib/i18n/messages";
import { enumLabel } from "@/lib/i18n/labels";
import { fmtMoney, fmtNumber, fmtDate, fmtDateTime } from "@/lib/i18n/format";
import { ReportHeader, ReportKpis, ReportSections } from "@/components/crm/report-shell";
import type { ReportPayload, ReportSection } from "@/lib/reports/types";

export const dynamic = "force-dynamic";

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

export default async function DealReportsPage() {
  const locale = await getLocale();
  const tr = (k: string, vars?: Record<string, string>) => translate(locale, k, vars);
  const now = new Date().toISOString();
  const stageField = metadata.getEntity("deal").fields.find((f) => f.name === "stage")!;

  let byStage: AggregateRow[] = [];
  let deals: EntityRecord[] = [];
  const accountName = new Map<string, string>();
  try {
    const [agg, list, accounts] = await Promise.all([
      serverApi.aggregate("deal", {
        groupBy: "stage",
        measures: [
          { op: "count", as: "count" },
          { op: "sum", field: "amount", as: "amount" },
        ],
      }),
      serverApi.list("deal", { pageSize: 200, sort: [{ field: "amount", dir: "desc" }] }),
      serverApi.list("account", { pageSize: 200 }),
    ]);
    byStage = agg;
    deals = list.items;
    for (const a of accounts.items) accountName.set(a.id, String(a.name));
  } catch {
    /* no read access */
  }

  const totalCount = byStage.reduce((s, r) => s + num(r.measures.count), 0);
  const totalAmount = byStage.reduce((s, r) => s + num(r.measures.amount), 0);
  const wonAmount = num(byStage.find((r) => r.key === "won")?.measures.amount);
  const openAmount = byStage.filter((r) => r.key !== "won" && r.key !== "lost").reduce((s, r) => s + num(r.measures.amount), 0);

  const kpis = [
    { label: tr("report.deals.totalDeals"), value: fmtNumber(locale, totalCount) },
    { label: tr("report.deals.totalValue"), value: fmtMoney(locale, totalAmount) },
    { label: tr("report.sales.openPipeline"), value: fmtMoney(locale, openAmount) },
    { label: tr("report.deals.wonValue"), value: fmtMoney(locale, wonAmount) },
  ];

  const byStageSection: ReportSection = {
    title: tr("report.deals.byStage"),
    columns: [
      { label: tr("report.col.stage") },
      { label: tr("report.col.deals"), kind: "number" },
      { label: tr("report.col.value"), kind: "currency" },
    ],
    rows: byStage.map((r) => [enumLabel(stageField, r.key, locale), num(r.measures.count), num(r.measures.amount)]),
    total: [tr("report.total"), totalCount, totalAmount],
  };

  const listSection: ReportSection = {
    title: tr("report.deals.list"),
    columns: [
      { label: tr("report.col.name") },
      { label: tr("report.col.account") },
      { label: tr("report.col.stage") },
      { label: tr("report.col.amount"), kind: "currency" },
      { label: tr("report.col.closeDate") },
    ],
    rows: deals.map((d) => [
      String(d.name ?? "—"),
      accountName.get(String(d.accountId)) ?? "—",
      enumLabel(stageField, d.stage as string, locale),
      num(d.amount),
      d.closeDate ? fmtDate(locale, String(d.closeDate)) : "—",
    ]),
  };

  const sections = [byStageSection, listSection];
  const payload: ReportPayload = {
    title: tr("report.deals.title"),
    subtitle: tr("report.deals.subtitle"),
    org: "Aula ERP",
    meta: [{ label: tr("report.generated"), value: fmtDateTime(locale, now) }],
    kpis,
    sections,
    currency: "USD",
  };

  return (
    <div className="space-y-4">
      <ReportHeader
        title={payload.title}
        subtitle={payload.subtitle}
        generated={`${tr("report.generated")}: ${fmtDateTime(locale, now)}`}
        payload={payload}
        fileName="deal-report"
        backLabel={tr("report.allReports")}
      />
      <ReportKpis kpis={kpis} />
      <ReportSections sections={sections} locale={locale} noData={tr("report.noData")} />
    </div>
  );
}
