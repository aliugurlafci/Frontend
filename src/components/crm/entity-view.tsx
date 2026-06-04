"use client";

import { useEffect, useMemo, useState } from "react";
import type { EntityDef, EntityRecord, FieldDef } from "@/lib/metadata/types";
import type { Sort } from "@/lib/data/query";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils/cn";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "./breadcrumbs";
import { DataTable } from "./data-table";
import { TableToolbar } from "./table-toolbar";
import { Pagination } from "./pagination";
import { KanbanBoard } from "./kanban-board";
import { RecordDrawer } from "./record-drawer";
import { CreateDrawer } from "./create-drawer";
import { useI18n } from "@/lib/i18n/context";

interface PageData {
  items: EntityRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function EntityView({
  entity,
  initial,
  canCreate,
  canDelete,
  canUpdate,
  focusId,
}: {
  entity: EntityDef;
  initial: PageData;
  canCreate: boolean;
  canDelete: boolean;
  canUpdate: boolean;
  focusId?: string;
}) {
  const { t, entityLabel } = useI18n();
  const pluralLabel = entityLabel(entity, { plural: true });
  const fieldsByName = useMemo(
    () => new Map(entity.fields.map((f) => [f.name, f] as const)),
    [entity.fields],
  );
  const columns: FieldDef[] = (entity.listColumns ?? entity.fields.slice(0, 4).map((f) => ({ field: f.name })))
    .map((c) => fieldsByName.get(c.field))
    .filter((f): f is FieldDef => Boolean(f));

  const [data, setData] = useState<PageData>(initial);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<Sort | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? null);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<"table" | "board">("table");

  function switchView(next: "table" | "board") {
    setView(next);
    // The board needs the whole list; the table paginates.
    setPageSize(next === "board" ? 200 : 25);
    setPage(1);
  }

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filtersKey = JSON.stringify(filters);
  const sortKey = sort ? `${sort.field}:${sort.dir}` : "";

  async function load() {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (sort) params.set("sort", `${sort.field}:${sort.dir}`);
    if (search) params.set("q", search);
    for (const [k, v] of Object.entries(filters)) if (v) params.set(`filter.${k}`, v);
    const result = await apiFetch<PageData>(`/entities/${entity.name}?${params.toString()}`);
    setData(result);
  }

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    load()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortKey, search, filtersKey]);

  function onSort(field: string) {
    setSort((prev) => (prev?.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" }));
    setPage(1);
  }

  return (
    <div className="space-y-3">
      <Breadcrumbs items={[{ label: t("breadcrumb.home"), href: "/" }, { label: pluralLabel }]} />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold">{pluralLabel}</h1>
          <p className="text-xs text-muted">{data.total} {t("common.records")}</p>
        </div>
        {entity.board && (
          <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
            <button
              onClick={() => switchView("table")}
              className={cn("rounded px-2.5 py-1", view === "table" ? "bg-surface-2 font-medium" : "text-muted")}
            >
              {t("view.list")}
            </button>
            <button
              onClick={() => switchView("board")}
              className={cn("rounded px-2.5 py-1", view === "board" ? "bg-surface-2 font-medium" : "text-muted")}
            >
              {t("view.board")}
            </button>
          </div>
        )}
      </div>

      {view === "board" && entity.board ? (
        <Card className="overflow-hidden">
          <TableToolbar
            entity={entity}
            search={searchInput}
            onSearch={(v) => setSearchInput(v)}
            filters={filters}
            onFilter={(field, value) => setFilters((prev) => ({ ...prev, [field]: value }))}
            canCreate={canCreate}
            onNew={() => setCreating(true)}
          />
          <div className="p-3">
            <KanbanBoard entity={entity} items={data.items} onMoved={load} onCardClick={setSelectedId} />
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <TableToolbar
            entity={entity}
            search={searchInput}
            onSearch={(v) => {
              setSearchInput(v);
              setPage(1);
            }}
            filters={filters}
            onFilter={(field, value) => {
              setFilters((prev) => ({ ...prev, [field]: value }));
              setPage(1);
            }}
            canCreate={canCreate}
            onNew={() => setCreating(true)}
          />

          {data.items.length === 0 && !loading ? (
            <EmptyState
              icon={entity.icon ?? "search"}
              title={t("list.empty", { entity: pluralLabel })}
              description={search || Object.values(filters).some(Boolean) ? t("list.emptyHint") : undefined}
            />
          ) : (
            <DataTable
              titleField={entity.titleField}
              columns={columns}
              rows={data.items}
              sort={sort}
              onSort={onSort}
              onRowClick={setSelectedId}
              loading={loading && data.items.length === 0}
              entityName={entity.name}
            />
          )}

          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            pageCount={data.pageCount}
            onPage={setPage}
            onPageSize={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </Card>
      )}

      <RecordDrawer
        key={selectedId ?? "none"}
        entity={entity}
        recordId={selectedId}
        canDelete={canDelete}
        canUpdate={canUpdate}
        onClose={() => setSelectedId(null)}
        onChanged={load}
      />

      <CreateDrawer
        key={`create-${creating}`}
        entity={entity}
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          load();
        }}
      />
    </div>
  );
}
