"use client";

import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";

export function Pagination({
  page,
  pageSize,
  total,
  pageCount,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const { t } = useI18n();
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs text-muted">
      <div className="flex items-center gap-2">
        <span>
          {from}–{to} / {total}
        </span>
        <Select
          aria-label="Rows per page"
          value={String(pageSize)}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="h-7 w-auto py-0 text-xs"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label={t("page.prev")}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-2 disabled:opacity-40"
        >
          <Icon name="chevronLeft" />
        </button>
        <span className="px-1">
          {page} / {Math.max(1, pageCount)}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          aria-label={t("page.next")}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-2 disabled:opacity-40"
        >
          <Icon name="chevronRight" />
        </button>
      </div>
    </div>
  );
}
