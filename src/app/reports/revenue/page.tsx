import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import type { AggregateRow } from "@/lib/data/query";
import { getLocale } from "@/lib/i18n/server";
import { t as translate } from "@/lib/i18n/messages";
import { enumLabel } from "@/lib/i18n/labels";
import { fmtMoney, fmtNumber, fmtDateTime } from "@/lib/i18n/format";
import { ReportHeader, ReportKpis, ReportSections } from "@/components/crm/report-shell";
import type { ReportPayload, ReportSection } from "@/lib/reports/types";

export const dynamic = "force-dynamic";

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

export default async function RevenueReportsPage() {
  const locale = await getLocale();
  const tr = (k: string, vars?: Record<string, string>) => translate(locale, k, vars);
  const now = new Date().toISOString();
  const statusField = metadata.getEntity("invoice").fields.find((f) => f.name === "status")!;
  const methodField = metadata.getEntity("payment").fields.find((f) => f.name === "method")!;

  let byStatus: AggregateRow[] = [];
  let byMethod: AggregateRow[] = [];
  let collectedRows: AggregateRow[] = [];
  try {
    [byStatus, byMethod, collectedRows] = await Promise.all([
      serverApi.aggregate("invoice", {
        groupBy: "status",
        measures: [
          { op: "count", as: "count" },
          { op: "sum", field: "total", as: "total" },
          { op: "sum", field: "balance", as: "balance" },
        ],
      }),
      serverApi.aggregate("payment", {
        groupBy: "method",
        measures: [
          { op: "count", as: "count" },
          { op: "sum", field: "amount", as: "amount" },
        ],
      }),
      serverApi.aggregate("payment", { measures: [{ op: "sum", field: "amount", as: "amount" }] }),
    ]);
  } catch {
    /* no read access */
  }

  const invoicedTotal = byStatus.reduce((s, r) => s + num(r.measures.total), 0);
  const invoiceCount = byStatus.reduce((s, r) => s + num(r.measures.count), 0);
  const outstanding = byStatus.reduce((s, r) => s + num(r.measures.balance), 0);
  const collected = collectedRows.reduce((s, r) => s + num(r.measures.amount), 0);
  const paidTotal = num(byStatus.find((r) => r.key === "paid")?.measures.total);
  const paymentCount = byMethod.reduce((s, r) => s + num(r.measures.count), 0);
  const paymentTotal = byMethod.reduce((s, r) => s + num(r.measures.amount), 0);

  const kpis = [
    { label: tr("report.revenue.invoiced"), value: fmtMoney(locale, invoicedTotal) },
    { label: tr("report.revenue.paidInvoices"), value: fmtMoney(locale, paidTotal) },
    { label: tr("report.revenue.collected"), value: fmtMoney(locale, collected) },
    { label: tr("report.revenue.outstanding"), value: fmtMoney(locale, outstanding) },
  ];

  const statusSection: ReportSection = {
    title: tr("report.revenue.byStatus"),
    columns: [
      { label: tr("report.col.status") },
      { label: tr("report.col.count"), kind: "number" },
      { label: tr("report.col.total"), kind: "currency" },
      { label: tr("report.col.balance"), kind: "currency" },
    ],
    rows: byStatus.map((r) => [enumLabel(statusField, r.key, locale), num(r.measures.count), num(r.measures.total), num(r.measures.balance)]),
    total: [tr("report.total"), invoiceCount, invoicedTotal, outstanding],
  };

  const methodSection: ReportSection = {
    title: tr("report.revenue.byMethod"),
    columns: [
      { label: tr("report.col.method") },
      { label: tr("report.col.payments"), kind: "number" },
      { label: tr("report.col.amount"), kind: "currency" },
    ],
    rows: byMethod.map((r) => [enumLabel(methodField, r.key, locale), num(r.measures.count), num(r.measures.amount)]),
    total: [tr("report.total"), paymentCount, paymentTotal],
  };

  const sections = [statusSection, methodSection];
  const payload: ReportPayload = {
    title: tr("report.revenue.title"),
    subtitle: tr("report.revenue.subtitle"),
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
        fileName="revenue-report"
        backLabel={tr("report.allReports")}
      />
      <ReportKpis kpis={kpis} />
      <ReportSections sections={sections} locale={locale} noData={tr("report.noData")} />
    </div>
  );
}
