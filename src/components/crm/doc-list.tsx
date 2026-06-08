import Link from "next/link";
import type { ReactNode } from "react";
import type { EntityRecord } from "@/lib/metadata/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";

export interface DocColumn {
  header: string;
  cell: (r: EntityRecord) => ReactNode;
}

/** Shared server-rendered list for the document editor screens (PO / vendor bill
 *  / GRN / journal entry). Each row links to its bespoke editor. */
export function DocList({
  title,
  subtitle,
  newHref,
  newLabel,
  canCreate,
  icon,
  emptyTitle,
  emptyDesc,
  columns,
  rows,
}: {
  title: string;
  subtitle: string;
  newHref: string;
  newLabel: string;
  canCreate: boolean;
  icon: string;
  emptyTitle: string;
  emptyDesc: string;
  columns: DocColumn[];
  rows: EntityRecord[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
        {canCreate && (
          <Link href={newHref}>
            <Button variant="primary" size="sm">
              {newLabel}
            </Button>
          </Link>
        )}
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={icon} title={emptyTitle} description={emptyDesc} />
        ) : (
          <Table>
            <THead>
              <tr>
                {columns.map((c) => (
                  <TH key={c.header}>{c.header}</TH>
                ))}
              </tr>
            </THead>
            <tbody>
              {rows.map((r) => (
                <TR key={r.id}>
                  {columns.map((c, i) => (
                    <TD key={i}>{c.cell(r)}</TD>
                  ))}
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
