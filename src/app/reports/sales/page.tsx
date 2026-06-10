import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import type { AggregateRow } from "@/lib/data/query";
import { getLocale } from "@/lib/i18n/server";
import { t as translate } from "@/lib/i18n/messages";
import { enumLabel } from "@/lib/i18n/labels";
import { fmtMoney, fmtNumber, fmtPercent, fmtDateTime } from "@/lib/i18n/format";
import { ReportHeader, ReportKpis, ReportSections } from "@/components/crm/report-shell";
import type { ReportPayload, ReportSection } from "@/lib/reports/types";

export const dynamic = "force-dynamic";

const num = (v: unknown): number => (typeof v === "number" ? v : 0);
const OPEN_STAGES = ["lead", "qualified", "proposal", "negotiation"];

export default async function SalesReportsPage() {
  const locale = await getLocale();
  const tr = (k: string, vars?: Record<string, string>) => translate(locale, k, vars);
  const now = new Date().toISOString();
  const stageField = metadata.getEntity("deal").fields.find((f) => f.name === "stage")!;

  let byStage: AggregateRow[] = [];
  try {
    byStage = await serverApi.aggregate("deal", {
      groupBy: "stage",
      measures: [
        { op: "count", as: "count" },
        { op: "sum", field: "amount", as: "amount" },
      ],
    });
  } catch {
    /* no read access */
  }

  const stageRow = (key: string) => byStage.find((r) => r.key === key);
  const wonAmount = num(stageRow("won")?.measures.amount);
  const wonCount = num(stageRow("won")?.measures.count);
  const lostCount = num(stageRow("lost")?.measures.count);
  const pipeline = byStage.filter((r) => OPEN_STAGES.includes(r.key ?? "")).reduce((s, r) => s + num(r.measures.amount), 0);
  const closedTotal = wonCount + lostCount;
  const winRate = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : 0;
  const totalDeals = byStage.reduce((s, r) => s + num(r.measures.count), 0);
  const totalValue = byStage.reduce((s, r) => s + num(r.measures.amount), 0);

  const kpis = [
    { label: tr("report.sales.wonRevenue"), value: fmtMoney(locale, wonAmount) },
    { label: tr("report.sales.wonDeals"), value: fmtNumber(locale, wonCount) },
    { label: tr("report.sales.openPipeline"), value: fmtMoney(locale, pipeline) },
    { label: tr("report.sales.winRate"), value: fmtPercent(locale, winRate) },
  ];

  const section: ReportSection = {
    title: tr("report.sales.byStage"),
    columns: [
      { label: tr("report.col.stage") },
      { label: tr("report.col.deals"), kind: "number" },
      { label: tr("report.col.value"), kind: "currency" },
    ],
    rows: byStage.map((r) => [enumLabel(stageField, r.key, locale), num(r.measures.count), num(r.measures.amount)]),
    total: [tr("report.total"), totalDeals, totalValue],
  };

  const payload: ReportPayload = {
    title: tr("report.sales.title"),
    subtitle: tr("report.sales.subtitle"),
    org: "Aula ERP",
    meta: [{ label: tr("report.generated"), value: fmtDateTime(locale, now) }],
    kpis,
    sections: [section],
    currency: "USD",
  };

  return (
    <div className="space-y-4">
      <ReportHeader
        title={payload.title}
        subtitle={payload.subtitle}
        generated={`${tr("report.generated")}: ${fmtDateTime(locale, now)}`}
        payload={payload}
        fileName="sales-report"
        backLabel={tr("report.allReports")}
      />
      <ReportKpis kpis={kpis} />
      <ReportSections sections={[section]} locale={locale} noData={tr("report.noData")} />
    </div>
  );
}
