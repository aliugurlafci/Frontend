import { test } from "node:test";
import assert from "node:assert/strict";
import { lineTotals, docTotals } from "@/lib/finance/totals";
import { NumberSequence } from "@/lib/finance/number-sequence";
import { toBase } from "@/lib/finance/money";

test("finance: line totals apply tax correctly", () => {
  const t = lineTotals({ qty: 3, unitPrice: 100, taxRate: 20 });
  assert.equal(t.lineSubtotal, 300);
  assert.equal(t.lineTax, 60);
  assert.equal(t.lineTotal, 360);
});

test("finance: document totals sum lines", () => {
  const t = docTotals([
    { qty: 2, unitPrice: 50, taxRate: 10 }, // 100 + 10
    { qty: 1, unitPrice: 200, taxRate: 0 }, // 200 + 0
  ]);
  assert.equal(t.subtotal, 300);
  assert.equal(t.taxTotal, 10);
  assert.equal(t.total, 310);
});

test("finance: number sequence increments per tenant+prefix", () => {
  const seq = new NumberSequence();
  assert.equal(seq.next("t1", "INV"), "INV-0001");
  assert.equal(seq.next("t1", "INV"), "INV-0002");
  assert.equal(seq.next("t2", "INV"), "INV-0001");
  seq.bump("t1", "INV", 50);
  assert.equal(seq.next("t1", "INV"), "INV-0051");
});

test("finance: currency conversion to base", () => {
  assert.equal(toBase(100, 1.08), 108);
});
