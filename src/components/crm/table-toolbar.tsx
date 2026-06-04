"use client";

import type { EntityDef } from "@/lib/metadata/types";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/context";
import { ExportMenu } from "./export-menu";

export function TableToolbar({
  entity,
  search,
  onSearch,
  filters,
  onFilter,
  canCreate,
  onNew,
}: {
  entity: EntityDef;
  search: string;
  onSearch: (value: string) => void;
  filters: Record<string, string>;
  onFilter: (field: string, value: string) => void;
  canCreate: boolean;
  onNew: () => void;
}) {
  const { t, entityLabel, fieldLabel, enumLabel } = useI18n();
  const plural = entityLabel(entity, { plural: true });
  const enumFilters = entity.fields.filter((f) => f.filterable && f.type === "enum");

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
      <div className="relative min-w-40 flex-1">
        <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-2">
          <Icon name="search" className="h-3.5 w-3.5" />
        </div>
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("common.search")}
          aria-label={`${t("common.search")} ${plural}`}
          className="h-8 pl-8 text-xs"
        />
      </div>

      {enumFilters.map((f) => (
        <Select
          key={f.name}
          aria-label={`${t("toolbar.filters")}: ${fieldLabel(f, entity.name)}`}
          value={filters[f.name] ?? ""}
          onChange={(e) => onFilter(f.name, e.target.value)}
          className="h-8 w-auto text-xs"
        >
          <option value="">{fieldLabel(f, entity.name)}: {t("common.all")}</option>
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {enumLabel(f, o.value)}
            </option>
          ))}
        </Select>
      ))}

      <div className="ml-auto flex items-center gap-2">
        <ExportMenu entity={entity.name} />
        {canCreate && (
          <Button variant="primary" size="sm" onClick={onNew}>
            <Icon name="plus" className="h-3.5 w-3.5" /> {t("common.new")}
          </Button>
        )}
      </div>
    </div>
  );
}
