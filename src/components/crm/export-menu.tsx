"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/context";

/**
 * Export dropdown — downloads the entity in Excel (.xlsx), PDF or CSV via the
 * `/api/v1/export/:entity?format=` endpoint. The server's Content-Disposition
 * drives the download (so no `download` attribute, which would lose the filename).
 */
export function ExportMenu({ entity, label }: { entity: string; label?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const item = (fmt: string, text: string) => (
    <a
      href={`/api/v1/export/${entity}?format=${fmt}`}
      onClick={() => setOpen(false)}
      className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-surface-2"
    >
      <Icon name="download" className="h-3.5 w-3.5 text-muted" />
      {text}
    </a>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-surface-2"
      >
        <Icon name="download" className="h-3.5 w-3.5" />
        {label ?? t("common.export")}
        <Icon name="chevronDown" className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-lg">
          {item("xlsx", "Excel (.xlsx)")}
          {item("pdf", "PDF")}
          {item("csv", "CSV")}
        </div>
      )}
    </div>
  );
}
