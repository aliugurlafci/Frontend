"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/context";
import type { ReportPayload } from "@/lib/reports/types";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/**
 * Report actions — export the report to Excel (server-rendered .xlsx) or to PDF
 * via the browser's print dialog (full Unicode + theme, like the document prints).
 * Hidden from the printed output via `.no-print`.
 */
export function ReportToolbar({ payload, fileName }: { payload: ReportPayload; fileName: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function downloadExcel() {
    setBusy(true);
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      const csrf = getCookie("aula_csrf");
      if (csrf) headers["x-csrf-token"] = csrf;
      const res = await fetch(`/api/v1/reports/export?format=xlsx`, {
        method: "POST",
        headers,
        body: JSON.stringify({ payload, fileName }),
      });
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("report.exportFailed"));
    } finally {
      setBusy(false);
    }
  }

  const btn = "inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium transition-colors hover:bg-surface-2 disabled:opacity-50";

  return (
    <div className="no-print flex items-center gap-2">
      <button type="button" onClick={downloadExcel} disabled={busy} className={btn}>
        <Icon name="download" className="h-3.5 w-3.5 text-success" />
        {t("report.exportExcel")}
      </button>
      <button type="button" onClick={() => window.print()} className={btn}>
        <Icon name="printer" className="h-3.5 w-3.5 text-danger" />
        {t("report.exportPdf")}
      </button>
    </div>
  );
}
