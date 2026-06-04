import { test } from "node:test";
import assert from "node:assert/strict";
import { FinanceService } from "@/lib/finance/service";
import { NumberSequence } from "@/lib/finance/number-sequence";
import { metadata } from "@/lib/metadata";
import { buildStack, makeCtx } from "./helpers";

test("invoice: payments update balance and status", async () => {
  const { qe, domain } = buildStack();
  const fin = new FinanceService(qe, metadata, new NumberSequence());
  const mgr = makeCtx({ roles: ["sales_manager"], userId: "u_mgr" });
  const account = await domain.create(mgr, "account", { name: "AR Co" });

  const inv = await fin.createDocument(mgr, "invoice", "INV", {
    accountId: account.id,
    currencyCode: "USD",
    issueDate: "2026-01-01",
    dueDate: "2026-02-01",
    status: "draft",
  });
  assert.equal(inv.number, "INV-0001");

  await fin.replaceLines(mgr, "invoice", "invoiceLine", "invoiceId", inv.id, [
    { description: "Service", qty: 1, unitPrice: 1000, taxRate: 0 },
  ]);

  let after = await fin.applyPayment(mgr, inv.id, { amount: 400, method: "bank", paidAt: "2026-01-10" });
  assert.equal(after.amountPaid, 400);
  assert.equal(after.balance, 600);
  assert.equal(after.status, "partial");

  after = await fin.applyPayment(mgr, inv.id, { amount: 600, method: "card", paidAt: "2026-01-20" });
  assert.equal(after.balance, 0);
  assert.equal(after.status, "paid");
});

test("invoice: convert quote copies lines into a draft invoice", async () => {
  const { qe, domain } = buildStack();
  const fin = new FinanceService(qe, metadata, new NumberSequence());
  const mgr = makeCtx({ roles: ["sales_manager"], userId: "u_mgr" });
  const account = await domain.create(mgr, "account", { name: "Convert Co" });

  const quote = await fin.createDocument(mgr, "quote", "Q", { accountId: account.id, currencyCode: "USD", status: "draft" });
  await fin.replaceLines(mgr, "quote", "quoteLine", "quoteId", quote.id, [
    { description: "A", qty: 2, unitPrice: 100, taxRate: 10 },
  ]);

  const invoiceId = await fin.convertQuoteToInvoice(mgr, quote.id);
  const { doc, lines } = await fin.getDocument(mgr, "invoice", "invoiceLine", "invoiceId", invoiceId);
  assert.equal(lines.length, 1);
  assert.equal(doc.quoteId, quote.id);
  assert.equal(doc.total, 220);
  assert.equal(doc.balance, 220);
});
