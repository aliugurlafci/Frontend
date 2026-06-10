import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import type { AggregateRow } from "@/lib/data/query";
import type { EntityRecord } from "@/lib/metadata/types";
import { getLocale } from "@/lib/i18n/server";
import { t as translate } from "@/lib/i18n/messages";
import { enumLabel } from "@/lib/i18n/labels";
import { fmtMoney, fmtDateTime } from "@/lib/i18n/format";
import { ReportHeader, ReportKpis, ReportSections } from "@/components/crm/report-shell";
import type { ReportPayload, ReportSection } from "@/lib/reports/types";

export const dynamic = "force-dynamic";

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

type AggParams = Parameters<typeof serverApi.aggregate>[1];

export default async function FinanceReportsPage() {
  const locale = await getLocale();
  const tr = (k: string, vars?: Record<string, string>) => translate(locale, k, vars);
  const now = new Date().toISOString();
  const typeField = metadata.getEntity("ledgerAccount").fields.find((f) => f.name === "type");

  let tb: AggregateRow[] = [];
  let accounts: EntityRecord[] = [];
  try {
    const params: AggParams = {
      groupBy: "ledgerAccountId",
      filters: [{ field: "posted", op: "eq", value: true }],
      measures: [
        { op: "sum", field: "debit", as: "debit" },
        { op: "sum", field: "credit", as: "credit" },
      ],
    };
    [tb, accounts] = await Promise.all([serverApi.aggregate("journalLine", params), serverApi.list("ledgerAccount", { pageSize: 1000 }).then((r) => r.items)]);
  } catch {
    /* no read access */
  }

  const acc = new Map(accounts.map((a) => [String(a.id), a]));
  let revenue = 0;
  let expense = 0;
  let sumDebit = 0;
  let sumCredit = 0;
  const tbRows: (string | number)[][] = [];
  for (const r of tb) {
    const a = acc.get(String(r.key));
    if (!a) continue;
    const dr = num(r.measures.debit);
    const cr = num(r.measures.credit);
    if (dr === 0 && cr === 0) continue;
    const type = String(a.type ?? "");
    if (type === "revenue") revenue += cr - dr;
    else if (type === "expense") expense += dr - cr;
    sumDebit += dr;
    sumCredit += cr;
    const typeLabel = typeField ? enumLabel(typeField, type, locale) : type;
    tbRows.push([String(a.name ?? a.code ?? "—"), typeLabel, dr, cr, dr - cr]);
  }
  tbRows.sort((x, y) => String(x[1]).localeCompare(String(y[1])) || String(x[0]).localeCompare(String(y[0])));
  const net = revenue - expense;

  const kpis = [
    { label: tr("report.finance.revenue"), value: fmtMoney(locale, revenue) },
    { label: tr("report.finance.expenses"), value: fmtMoney(locale, expense) },
    { label: tr("report.finance.netIncome"), value: fmtMoney(locale, net) },
  ];

  const pnlSection: ReportSection = {
    title: tr("report.finance.pnl"),
    columns: [{ label: tr("report.col.type") }, { label: tr("report.col.amount"), kind: "currency" }],
    rows: [
      [tr("report.finance.revenue"), revenue],
      [tr("report.finance.expenses"), expense],
    ],
    total: [tr("report.finance.netIncome"), net],
  };

  const tbSection: ReportSection = {
    title: tr("report.finance.trialBalance"),
    columns: [
      { label: tr("report.col.account") },
      { label: tr("report.col.type") },
      { label: tr("report.col.debit"), kind: "currency" },
      { label: tr("report.col.credit"), kind: "currency" },
      { label: tr("report.col.balance"), kind: "currency" },
    ],
    rows: tbRows,
    total: [tr("report.total"), "", sumDebit, sumCredit, sumDebit - sumCredit],
  };

  const sections = [pnlSection, tbSection];
  const payload: ReportPayload = {
    title: tr("report.finance.title"),
    subtitle: tr("report.finance.subtitle"),
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
        fileName="finance-report"
        backLabel={tr("report.allReports")}
      />
      <ReportKpis kpis={kpis} />
      <ReportSections sections={sections} locale={locale} noData={tr("report.noData")} />
    </div>
  );
}
