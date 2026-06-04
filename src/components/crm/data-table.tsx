"use client";

import { Table } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import type { EntityRecord, FieldDef } from "@/lib/metadata/types";
import type { Sort } from "@/lib/data/query";
import { ValueCell } from "./value-cell";
import { useI18n } from "@/lib/i18n/context";

/**
 * Server-driven entity grid, rendered with Ant Design's <Table>.
 *
 * The public props are unchanged from the previous bespoke table, so EntityView,
 * the toolbar, the external Pagination and the record drawer keep working as-is:
 *  - sorting stays server-side (sorter:true + controlled sortOrder → onSort)
 *  - antd's own pagination is disabled (the existing Pagination component drives it)
 *  - a row click opens the record drawer (onRow → onRowClick)
 *  - `loading` shows antd's spin overlay
 *  - columns scroll horizontally on small screens instead of a separate card view
 */
export function DataTable({
  titleField,
  columns,
  rows,
  sort,
  onSort,
  onRowClick,
  loading,
  entityName,
}: {
  titleField: string;
  columns: FieldDef[];
  rows: EntityRecord[];
  sort: Sort | null;
  onSort: (field: string) => void;
  onRowClick: (id: string) => void;
  loading?: boolean;
  entityName?: string;
}) {
  const { locale, fieldLabel } = useI18n();

  const antdColumns: ColumnsType<EntityRecord> = columns.map((c) => ({
    key: c.name,
    title: fieldLabel(c, entityName),
    dataIndex: c.name,
    ellipsis: true,
    sorter: c.sortable ? true : undefined,
    sortOrder:
      c.sortable && sort?.field === c.name ? (sort.dir === "asc" ? "ascend" : "descend") : null,
    showSorterTooltip: false,
    render: (_value: unknown, record: EntityRecord) => (
      <span className={c.name === titleField ? "font-medium" : undefined}>
        <ValueCell field={c} value={record[c.name] ?? null} locale={locale} />
      </span>
    ),
  }));

  // Server-side sorting: ignore antd's local sort, just toggle the active column.
  const handleChange: TableProps<EntityRecord>["onChange"] = (_pagination, _filters, sorter) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    if (s?.columnKey) onSort(String(s.columnKey));
  };

  return (
    <Table<EntityRecord>
      rowKey="id"
      columns={antdColumns}
      dataSource={rows}
      loading={loading}
      pagination={false}
      size="middle"
      scroll={{ x: "max-content" }}
      onChange={handleChange}
      onRow={(record) => ({
        onClick: () => onRowClick(record.id),
        style: { cursor: "pointer" },
      })}
    />
  );
}
