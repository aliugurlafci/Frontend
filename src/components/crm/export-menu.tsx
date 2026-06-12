"use client";

import { Icon } from "@/components/ui/icon";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/context";

/**
 * Export dropdown — downloads the entity in Excel (.xlsx), PDF or CSV via the
 * `/api/v1/export/:entity?format=` endpoint. The server's Content-Disposition
 * drives the download (so no `download` attribute, which would lose the filename).
 *
 * Uses the shared portalled `DropdownMenu` so the panel escapes any
 * `transform`/`backdrop-filter` ancestor (e.g. an `animate-rise` wrapper or the
 * glass card) that would otherwise trap it behind neighbouring buttons.
 */
export function ExportMenu({ entity, label }: { entity: string; label?: string }) {
  const { t } = useI18n();

  const item = (fmt: string, text: string, close: () => void) => (
    <a
      href={`/api/v1/export/${entity}?format=${fmt}`}
      role="menuitem"
      tabIndex={-1}
      onClick={close}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-surface-2 focus:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <Icon name="download" className="h-4 w-4 text-muted" />
      {text}
    </a>
  );

  return (
    <DropdownMenu
      align="end"
      panelClassName="min-w-40"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-surface-2"
        >
          <Icon name="download" className="h-3.5 w-3.5" />
          {label ?? t("common.export")}
          <Icon name="chevronDown" className="h-3 w-3" />
        </button>
      )}
    >
      {({ close }) => (
        <>
          {item("xlsx", "Excel (.xlsx)", close)}
          {item("pdf", "PDF", close)}
          {item("csv", "CSV", close)}
        </>
      )}
    </DropdownMenu>
  );
}
