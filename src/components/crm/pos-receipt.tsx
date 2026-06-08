"use client";

import type { EntityRecord } from "@/lib/metadata/types";
import { formatMoney } from "@/lib/finance/money";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BarcodeSvg } from "./barcode-svg";

/** Thermal-style (~80mm) POS receipt for a completed sale, with a Code128
 *  barcode of the invoice number. Browser "Print → Save as PDF" or a roll
 *  printer. The 58mm @page keeps it roll-friendly. */
export function PosReceipt({ doc, lines }: { doc: EntityRecord; lines: EntityRecord[] }) {
  const currency = String(doc.currencyCode ?? "USD");
  const money = (n: unknown) => formatMoney(typeof n === "number" ? n : Number(n ?? 0), currency);
  const number = String(doc.number ?? "");

  return (
    <div className="mx-auto max-w-sm">
      <style dangerouslySetInnerHTML={{ __html: "@media print { @page { size: 58mm auto; margin: 4mm; } }" }} />

      <div className="no-print mb-4 flex justify-between">
        <a href="/pos" className="text-sm text-muted hover:text-foreground">
          <Icon name="chevronLeft" className="inline h-4 w-4" /> POS
        </a>
        <Button variant="primary" size="sm" onClick={() => window.print()}>
          <Icon name="printer" className="h-3.5 w-3.5" /> Print receipt
        </Button>
      </div>

      <div className="mx-auto w-[300px] rounded-lg border border-border bg-white p-4 text-black">
        <div className="text-center">
          <div className="text-base font-bold">Aula Store</div>
          <div className="text-[11px] text-gray-600">123 Market Street · +1-555-0000</div>
        </div>

        <div className="my-2 border-t border-dashed border-gray-400" />

        <div className="text-[11px]">
          <div className="flex justify-between"><span>Receipt</span><span>{number}</span></div>
          <div className="flex justify-between">
            <span>Date</span>
            <span>{doc.issueDate ? new Date(String(doc.issueDate)).toLocaleDateString() : ""}</span>
          </div>
        </div>

        <div className="my-2 border-t border-dashed border-gray-400" />

        <table className="w-full text-[11px]">
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="py-0.5 align-top">
                  {String(l.description)}
                  <div className="text-gray-500">
                    {String(l.qty)} × {money(l.unitPrice)}
                  </div>
                </td>
                <td className="py-0.5 text-right align-top tabular-nums">{money(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-2 border-t border-dashed border-gray-400" />

        <div className="space-y-0.5 text-[11px]">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(doc.subtotal)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span className="tabular-nums">{money(doc.taxTotal)}</span></div>
          <div className="flex justify-between text-sm font-bold"><span>Total</span><span className="tabular-nums">{money(doc.total)}</span></div>
          <div className="flex justify-between"><span>Paid</span><span className="tabular-nums">{money(doc.amountPaid)}</span></div>
        </div>

        <div className="my-3 flex justify-center">
          <BarcodeSvg value={number || "RECEIPT"} type="code128" height={42} width={1.2} fontSize={11} margin={0} />
        </div>

        <div className="text-center text-[11px] text-gray-600">Thank you for your purchase!</div>
      </div>
    </div>
  );
}
