/**
 * Shared report payload — built (pre-localized) by the server report pages and
 * sent to the backend `/reports/export` endpoint for Excel rendering. The same
 * object can drive on-screen rendering, so a report is described once.
 */
export type ReportCellKind = "text" | "number" | "currency";

export interface ReportColumn {
  label: string;
  kind?: ReportCellKind;
  align?: "left" | "right" | "center";
}

export interface ReportSection {
  title: string;
  columns: ReportColumn[];
  /** Raw cell values — numbers for number/currency columns (so Excel can format them). */
  rows: (string | number | null)[][];
  /** Optional totals row, aligned 1:1 with `columns`. */
  total?: (string | number | null)[];
  note?: string;
}

export interface ReportKpi {
  label: string;
  value: string;
}

export interface ReportPayload {
  title: string;
  subtitle?: string;
  org?: string;
  meta?: { label: string; value: string }[];
  kpis?: ReportKpi[];
  sections: ReportSection[];
  currency?: string;
}
