"use client";

import type { EntityDef, EntityRecord } from "@/lib/metadata/types";
import { formatMoney } from "@/lib/finance/money";
import { Button } from "@/components/ui/button";

/** Phase F4 — printable quote/invoice document (browser "Print → Save as PDF"). */
export function DocumentPrint({
  entity,
  doc,
  lines,
  accountName,
}: {
  entity: EntityDef;
  doc: EntityRecord;
  lines: EntityRecord[];
  accountName: string;
}) {
  const currency = String(doc.currencyCode ?? "USD");
  const money = (n: unknown) => formatMoney(typeof n === "number" ? n : 0, currency);
  const dateFields = entity.fields.filter((f) => f.type === "date");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex justify-end">
        <Button variant="primary" size="sm" onClick={() => window.print()}>
          Print / Save PDF
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xl font-bold">Aula CRM</div>
            <div className="text-xs text-muted">123 Market Street · contact@aula.crm</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold uppercase">{entity.label}</div>
            <div className="text-sm">{String(doc.number ?? "")}</div>
            <div className="text-xs text-muted">Status: {String(doc.status)}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs font-semibold uppercase text-muted">Bill To</div>
            <div>{accountName || "—"}</div>
          </div>
          <div className="text-right">
            {dateFields.map((f) => (
              <div key={f.name} className="text-xs">
                <span className="text-muted">{f.label}: </span>
                {doc[f.name] ? new Date(String(doc[f.name])).toLocaleDateString() : "—"}
              </div>
            ))}
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted">
            <tr>
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit</th>
              <th className="py-2 text-right">Tax</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-border">
                <td className="py-1.5">{String(l.description)}</td>
                <td className="py-1.5 text-right">{String(l.qty)}</td>
                <td className="py-1.5 text-right">{money(l.unitPrice)}</td>
                <td className="py-1.5 text-right">{String(l.taxRate)}%</td>
                <td className="py-1.5 text-right">{money(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span>{money(doc.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Tax</span>
              <span>{money(doc.taxTotal)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 font-semibold">
              <span>Total</span>
              <span>{money(doc.total)}</span>
            </div>
            {typeof doc.balance === "number" && (
              <div className="flex justify-between font-semibold text-danger">
                <span>Balance Due</span>
                <span>{money(doc.balance)}</span>
              </div>
            )}
          </div>
        </div>

        {doc.notes && <p className="mt-6 text-xs text-muted">{String(doc.notes)}</p>}
      </div>
    </div>
  );
}
