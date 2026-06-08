"use client";

import type { EntityRecord } from "@/lib/metadata/types";
import { lineTotals } from "@/lib/finance/totals";
import { formatMoney } from "@/lib/finance/money";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";

export interface EditableLine {
  productId: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
}

export function emptyLine(): EditableLine {
  return { productId: null, description: "", qty: 1, unitPrice: 0, taxRate: 0 };
}

/** Phase F4 — master-detail line grid with live per-line and document totals. */
export function LineItemsEditor({
  lines,
  products,
  currencyCode,
  readOnly,
  priceSource = "unitPrice",
  onChange,
}: {
  lines: EditableLine[];
  products: EntityRecord[];
  currencyCode: string;
  readOnly?: boolean;
  /** Which product field prefills the line price (sales docs: unitPrice; purchasing: costPrice). */
  priceSource?: "unitPrice" | "costPrice";
  onChange: (lines: EditableLine[]) => void;
}) {
  function update(i: number, patch: Partial<EditableLine>) {
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function pickProduct(i: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) {
      update(i, { productId: null });
      return;
    }
    const price = p[priceSource];
    update(i, {
      productId,
      description: String(p.name ?? ""),
      unitPrice: typeof price === "number" ? price : 0,
      taxRate: typeof p.taxRate === "number" ? p.taxRate : 0,
    });
  }

  const totals = lines.reduce(
    (acc, l) => {
      const t = lineTotals(l);
      acc.subtotal += t.lineSubtotal;
      acc.tax += t.lineTax;
      return acc;
    },
    { subtotal: 0, tax: 0 },
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-surface-2 text-left text-xs uppercase text-muted">
          <tr>
            <th className="px-2 py-2 font-medium">Product / Description</th>
            <th className="w-20 px-2 py-2 font-medium">Qty</th>
            <th className="w-28 px-2 py-2 font-medium">Unit Price</th>
            <th className="w-20 px-2 py-2 font-medium">Tax %</th>
            <th className="w-28 px-2 py-2 text-right font-medium">Total</th>
            {!readOnly && <th className="w-8" />}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-border last:border-0 align-top">
              <td className="px-2 py-1.5">
                {!readOnly && (
                  <Select
                    aria-label="Product"
                    value={l.productId ?? ""}
                    onChange={(e) => pickProduct(i, e.target.value)}
                    className="mb-1 h-8 text-xs"
                  >
                    <option value="">— Custom —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {String(p.name)}
                      </option>
                    ))}
                  </Select>
                )}
                {readOnly ? (
                  <span>{l.description}</span>
                ) : (
                  <Input
                    aria-label="Description"
                    value={l.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="Description"
                  />
                )}
              </td>
              <td className="px-2 py-1.5">
                {readOnly ? (
                  l.qty
                ) : (
                  <Input
                    aria-label="Qty"
                    type="number"
                    value={String(l.qty)}
                    onChange={(e) => update(i, { qty: Number(e.target.value) })}
                    className="h-8 text-xs"
                  />
                )}
              </td>
              <td className="px-2 py-1.5">
                {readOnly ? (
                  formatMoney(l.unitPrice, currencyCode)
                ) : (
                  <Input
                    aria-label="Unit price"
                    type="number"
                    value={String(l.unitPrice)}
                    onChange={(e) => update(i, { unitPrice: Number(e.target.value) })}
                    className="h-8 text-xs"
                  />
                )}
              </td>
              <td className="px-2 py-1.5">
                {readOnly ? (
                  `${l.taxRate}%`
                ) : (
                  <Input
                    aria-label="Tax rate"
                    type="number"
                    value={String(l.taxRate)}
                    onChange={(e) => update(i, { taxRate: Number(e.target.value) })}
                    className="h-8 text-xs"
                  />
                )}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(lineTotals(l).lineTotal, currencyCode)}</td>
              {!readOnly && (
                <td className="px-1 py-1.5">
                  <button
                    onClick={() => onChange(lines.filter((_, idx) => idx !== i))}
                    aria-label="Remove line"
                    className="text-muted hover:text-danger"
                  >
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={readOnly ? 5 : 6} className="px-3 py-4 text-center text-xs text-muted">
                No line items.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot className="border-t border-border bg-surface-2">
          <tr>
            <td colSpan={readOnly ? 4 : 5} className="px-2 py-1.5 text-right text-xs text-muted">
              Subtotal
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(totals.subtotal, currencyCode)}</td>
            {!readOnly && <td />}
          </tr>
          <tr>
            <td colSpan={readOnly ? 4 : 5} className="px-2 py-1.5 text-right text-xs text-muted">
              Tax
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(totals.tax, currencyCode)}</td>
            {!readOnly && <td />}
          </tr>
          <tr>
            <td colSpan={readOnly ? 4 : 5} className="px-2 py-1.5 text-right text-sm font-semibold">
              Total
            </td>
            <td className="px-2 py-1.5 text-right text-sm font-semibold tabular-nums">
              {formatMoney(totals.subtotal + totals.tax, currencyCode)}
            </td>
            {!readOnly && <td />}
          </tr>
        </tfoot>
      </table>
      {!readOnly && (
        <div className="border-t border-border p-2">
          <Button size="sm" onClick={() => onChange([...lines, emptyLine()])}>
            <Icon name="plus" className="h-3.5 w-3.5" /> Add line
          </Button>
        </div>
      )}
    </div>
  );
}
