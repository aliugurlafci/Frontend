import { test } from "node:test";
import assert from "node:assert/strict";
import { FinanceService } from "@/lib/finance/service";
import { NumberSequence } from "@/lib/finance/number-sequence";
import { metadata } from "@/lib/metadata";
import { buildStack, makeCtx } from "./helpers";

test("finance doc: create quote, replace lines, compute totals + number", async () => {
  const { qe, domain } = buildStack();
  const fin = new FinanceService(qe, metadata, new NumberSequence());
  const mgr = makeCtx({ roles: ["sales_manager"], userId: "u_mgr" });

  const account = await domain.create(mgr, "account", { name: "Acme Quotes" });
  const doc = await fin.createDocument(mgr, "quote", "Q", {
    accountId: account.id,
    currencyCode: "USD",
    status: "draft",
  });
  assert.equal(doc.number, "Q-0001");

  await fin.replaceLines(mgr, "quote", "quoteLine", "quoteId", doc.id, [
    { description: "A", qty: 2, unitPrice: 100, taxRate: 20 }, // 200 + 40
    { description: "B", qty: 1, unitPrice: 50, taxRate: 0 }, // 50 + 0
  ]);

  const { doc: updated, lines } = await fin.getDocument(mgr, "quote", "quoteLine", "quoteId", doc.id);
  assert.equal(lines.length, 2);
  assert.equal(updated.subtotal, 250);
  assert.equal(updated.taxTotal, 40);
  assert.equal(updated.total, 290);

  // Replacing lines again recomputes (and removes the old ones).
  await fin.replaceLines(mgr, "quote", "quoteLine", "quoteId", doc.id, [
    { description: "C", qty: 1, unitPrice: 1000, taxRate: 10 },
  ]);
  const after = await fin.getDocument(mgr, "quote", "quoteLine", "quoteId", doc.id);
  assert.equal(after.lines.length, 1);
  assert.equal(after.doc.total, 1100);
});
