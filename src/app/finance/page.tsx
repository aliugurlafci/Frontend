import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { getLocale } from "@/lib/i18n/server";
import { t as translate } from "@/lib/i18n/messages";
import { enumLabel } from "@/lib/i18n/labels";
import { fmtMoney, fmtPercent, fmtDate, fmtDateTime } from "@/lib/i18n/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { enumTone } from "@/components/crm/field-format";
import { PipelineBarChart, type ChartDatum } from "@/components/crm/dashboard-charts";
import { RunRecurringButton } from "@/components/crm/run-recurring-button";
import { ReportToolbar } from "@/components/crm/report-toolbar";
import type { ReportPayload, ReportSection } from "@/lib/reports/types";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const num = (v: unknown): number => (typeof v === "number" ? v : 0);

function monthlyAmount(amount: number, frequency: string): number {
  if (frequency === "weekly") return (amount * 52) / 12;
  if (frequency === "quarterly") return amount / 3;
  if (frequency === "yearly") return amount / 12;
  return amount;
}

export default async function FinancePage() {
  const locale = await getLocale();
  const tr = (k: string, vars?: Record<string, string>) => translate(locale, k, vars);
  const now = new Date().toISOString();
  const money = (n: number) => fmtMoney(locale, n);
  const statusField = metadata.getEntity("invoice").fields.find((f) => f.name === "status")!;

  const today = now.slice(0, 10);
  const todayMs = new Date(today).getTime();

  const [invoices, plans, accounts] = await Promise.all([
    serverApi.list("invoice", { pageSize: 500, sort: [{ field: "number", dir: "desc" }] }),
    serverApi.list("recurringPlan", { pageSize: 200 }),
    serverApi.list("account", { pageSize: 200 }),
  ]);
  const accountName = new Map(accounts.items.map((a) => [a.id, String(a.name)]));

  let outstanding = 0;
  let overdue = 0;
  let collected = 0;
  let invoicedTotal = 0;
  const aging = { current: 0, d30: 0, d60: 0, d60plus: 0 };
  const open: { number: string; account: string; status: string; due: string; balance: number }[] = [];

  for (const inv of invoices.items) {
    const balance = num(inv.balance);
    collected += num(inv.amountPaid);
    invoicedTotal += num(inv.total);
    const status = String(inv.status);
    if (status === "paid" || status === "void" || balance <= 0) continue;
    outstanding += balance;
    const dueMs = inv.dueDate ? new Date(String(inv.dueDate)).getTime() : todayMs;
    const daysLate = Math.floor((todayMs - dueMs) / DAY);
    if (daysLate > 0) overdue += balance;
    if (daysLate <= 0) aging.current += balance;
    else if (daysLate <= 30) aging.d30 += balance;
    else if (daysLate <= 60) aging.d60 += balance;
    else aging.d60plus += balance;
    open.push({
      number: String(inv.number ?? "—"),
      account: accountName.get(String(inv.accountId)) ?? "—",
      status,
      due: inv.dueDate ? String(inv.dueDate) : "",
      balance,
    });
  }
  open.sort((a, b) => b.balance - a.balance);

  const mrr = plans.items
    .filter((p) => p.active)
    .reduce((s, p) => s + monthlyAmount(num(p.amount), String(p.frequency)), 0);
  const collectionRate = invoicedTotal > 0 ? Math.round((collected / invoicedTotal) * 100) : 0;

  const buckets = [
    { key: "current", label: tr("finance.aging.current"), value: Math.round(aging.current), color: "var(--success)" },
    { key: "d30", label: tr("finance.aging.d30"), value: Math.round(aging.d30), color: "var(--info)" },
    { key: "d60", label: tr("finance.aging.d60"), value: Math.round(aging.d60), color: "var(--warning)" },
    { key: "d60plus", label: tr("finance.aging.d60plus"), value: Math.round(aging.d60plus), color: "var(--danger)" },
  ];
  const agingData: ChartDatum[] = buckets.map((b) => ({ label: b.label, value: b.value, color: b.color }));
  const share = (v: number) => (outstanding > 0 ? Math.round((v / outstanding) * 100) : 0);

  const kpis = [
    { label: tr("finance.outstanding"), value: money(outstanding) },
    { label: tr("finance.overdue"), value: money(overdue) },
    { label: tr("finance.collected"), value: money(collected) },
    { label: tr("finance.collectionRate"), value: fmtPercent(locale, collectionRate) },
    { label: tr("finance.mrr"), value: money(Math.round(mrr)) },
  ];

  // ── export payload ─────────────────────────────────────────────────────
  const agingSection: ReportSection = {
    title: tr("finance.agingBreakdown"),
    columns: [
      { label: tr("finance.bucket") },
      { label: tr("report.col.amount"), kind: "currency" },
      { label: tr("finance.share") },
    ],
    rows: buckets.map((b) => [b.label, b.value, fmtPercent(locale, share(b.value))]),
    total: [tr("report.total"), Math.round(outstanding), fmtPercent(locale, outstanding > 0 ? 100 : 0)],
  };
  const invoiceSection: ReportSection = {
    title: tr("finance.allInvoices"),
    columns: [
      { label: tr("finance.col.number") },
      { label: tr("report.col.account") },
      { label: tr("report.col.status") },
      { label: tr("report.col.closeDate") },
      { label: tr("report.col.balance"), kind: "currency" },
    ],
    rows: open.map((o) => [o.number, o.account, enumLabel(statusField, o.status, locale), o.due ? fmtDate(locale, o.due) : "—", o.balance]),
    total: [tr("report.total"), "", "", "", Math.round(outstanding)],
  };
  const payload: ReportPayload = {
    title: tr("finance.title"),
    subtitle: tr("finance.subtitle"),
    org: "Aula ERP",
    meta: [{ label: tr("report.generated"), value: fmtDateTime(locale, now) }],
    kpis,
    sections: [agingSection, invoiceSection],
    currency: "USD",
  };

  const recent = invoices.items.slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{tr("finance.title")}</h1>
          <p className="text-xs text-muted">{tr("finance.subtitle")}</p>
          <p className="mt-0.5 text-[11px] text-muted-2">{`${tr("report.generated")}: ${fmtDateTime(locale, now)}`}</p>
        </div>
        <div className="no-print flex items-center gap-2">
          <RunRecurringButton />
          <ReportToolbar payload={payload} fileName="finance-ar" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardBody>
              <p className="text-xs text-muted">{k.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{k.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="break-avoid">
          <CardHeader title={tr("finance.arAging")} />
          <CardBody>
            <PipelineBarChart data={agingData} kind="currency" />
          </CardBody>
        </Card>

        <Card className="break-avoid">
          <CardHeader title={tr("finance.agingBreakdown")} />
          <CardBody className="p-0">
            <Table>
              <THead>
                <tr>
                  <TH>{tr("finance.bucket")}</TH>
                  <TH className="text-right">{tr("report.col.amount")}</TH>
                  <TH className="text-right">{tr("finance.share")}</TH>
                </tr>
              </THead>
              <tbody>
                {buckets.map((b) => (
                  <TR key={b.key}>
                    <TD>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.color }} aria-hidden />
                        {b.label}
                      </span>
                    </TD>
                    <TD className="text-right tabular-nums">{money(b.value)}</TD>
                    <TD className="text-right tabular-nums text-muted">{fmtPercent(locale, share(b.value))}</TD>
                  </TR>
                ))}
                <TR className="bg-surface-2/40">
                  <TD className="font-semibold">{tr("report.total")}</TD>
                  <TD className="text-right font-semibold tabular-nums">{money(Math.round(outstanding))}</TD>
                  <TD className="text-right font-semibold tabular-nums">{fmtPercent(locale, outstanding > 0 ? 100 : 0)}</TD>
                </TR>
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>

      <Card className="break-avoid">
        <CardHeader title={tr("finance.recentInvoices")} />
        <CardBody className="p-0">
          <Table>
            <THead>
              <tr>
                <TH>{tr("finance.col.number")}</TH>
                <TH>{tr("report.col.account")}</TH>
                <TH>{tr("report.col.status")}</TH>
                <TH>{tr("report.col.closeDate")}</TH>
                <TH className="text-right">{tr("report.col.balance")}</TH>
              </tr>
            </THead>
            <tbody>
              {recent.length === 0 ? (
                <TR>
                  <TD>{tr("report.noData")}</TD>
                  <TD>—</TD>
                  <TD>—</TD>
                  <TD>—</TD>
                  <TD>—</TD>
                </TR>
              ) : (
                recent.map((inv) => (
                  <TR key={inv.id}>
                    <TD>{String(inv.number ?? "—")}</TD>
                    <TD>{accountName.get(String(inv.accountId)) ?? "—"}</TD>
                    <TD>
                      <Badge tone={enumTone(statusField, inv.status)}>{enumLabel(statusField, inv.status as string, locale)}</Badge>
                    </TD>
                    <TD>{inv.dueDate ? fmtDate(locale, String(inv.dueDate)) : "—"}</TD>
                    <TD className="text-right tabular-nums">{money(num(inv.balance))}</TD>
                  </TR>
                ))
              )}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
