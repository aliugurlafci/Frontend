import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";
import { fmtMoney, fmtNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { ReportKpi, ReportSection, ReportPayload } from "@/lib/reports/types";
import { ReportToolbar } from "./report-toolbar";

/** Page header: title + subtitle + generated stamp + export actions (+ optional back link). */
export function ReportHeader({
  title,
  subtitle,
  generated,
  payload,
  fileName,
  backLabel,
}: {
  title: string;
  subtitle?: string;
  generated: string;
  payload: ReportPayload;
  fileName: string;
  backLabel?: string;
}) {
  return (
    <div className="space-y-2">
      {backLabel && (
        <Link href="/reports" className="no-print inline-flex text-xs font-medium text-primary hover:underline">
          {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          <p className="mt-0.5 text-[11px] text-muted-2">{generated}</p>
        </div>
        <ReportToolbar payload={payload} fileName={fileName} />
      </div>
    </div>
  );
}

/** A row of KPI cards (values are pre-formatted strings). */
export function ReportKpis({ kpis }: { kpis: ReportKpi[] }) {
  if (kpis.length === 0) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((k, i) => (
        <Card key={i}>
          <CardBody>
            <div className="text-xs text-muted">{k.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{k.value}</div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function renderCell(locale: Locale, kind: ReportSection["columns"][number]["kind"], v: string | number | null, currency: string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") {
    if (kind === "currency") return fmtMoney(locale, v, currency);
    if (kind === "number") return fmtNumber(locale, v);
    return String(v);
  }
  return String(v);
}

/** Render report sections as themed, locale-formatted tables (numeric cols right-aligned). */
export function ReportSections({
  sections,
  locale,
  currency = "USD",
  noData,
}: {
  sections: ReportSection[];
  locale: Locale;
  currency?: string;
  noData: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {sections.map((s, si) => {
        const numeric = (k: ReportSection["columns"][number]["kind"]) => k === "currency" || k === "number";
        const full = s.columns.length > 3;
        return (
          <Card key={si} className={cn(full && "lg:col-span-2")}>
            <CardHeader title={s.title} />
            <CardBody className="p-0">
              <Table>
                <THead>
                  <tr>
                    {s.columns.map((c, i) => (
                      <TH key={i} className={numeric(c.kind) ? "text-right" : undefined}>
                        {c.label}
                      </TH>
                    ))}
                  </tr>
                </THead>
                <tbody>
                  {s.rows.length === 0 ? (
                    <TR>
                      <TD>{noData}</TD>
                      {s.columns.slice(1).map((_, i) => (
                        <TD key={i}>—</TD>
                      ))}
                    </TR>
                  ) : (
                    s.rows.map((row, ri) => (
                      <TR key={ri}>
                        {s.columns.map((c, ci) => (
                          <TD key={ci} className={numeric(c.kind) ? "text-right tabular-nums" : undefined}>
                            {renderCell(locale, c.kind, row[ci] ?? null, currency)}
                          </TD>
                        ))}
                      </TR>
                    ))
                  )}
                  {s.total && s.rows.length > 0 && (
                    <TR className="bg-surface-2/40">
                      {s.columns.map((c, ci) => (
                        <TD
                          key={ci}
                          className={cn("font-semibold", numeric(c.kind) && "text-right tabular-nums")}
                        >
                          {renderCell(locale, c.kind, s.total![ci] ?? null, currency)}
                        </TD>
                      ))}
                    </TR>
                  )}
                </tbody>
              </Table>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
