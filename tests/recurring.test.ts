import { test } from "node:test";
import assert from "node:assert/strict";
import { FinanceService } from "@/lib/finance/service";
import { NumberSequence } from "@/lib/finance/number-sequence";
import { metadata } from "@/lib/metadata";
import { buildStack, makeCtx } from "./helpers";

test("recurring: billing run generates due invoices and advances nextRun", async () => {
  const { qe, domain } = buildStack();
  const fin = new FinanceService(qe, metadata, new NumberSequence());
  const mgr = makeCtx({ roles: ["sales_manager"], userId: "u_mgr", at: "2026-06-01T00:00:00.000Z" });
  const account = await domain.create(mgr, "account", { name: "Sub Co" });

  const plan = await domain.create(mgr, "recurringPlan", {
    name: "Monthly",
    accountId: account.id,
    description: "Subscription",
    amount: 1000,
    taxRate: 20,
    currencyCode: "USD",
    frequency: "monthly",
    nextRun: "2026-05-15",
    active: true,
  });

  const generated = await fin.generateDueInvoices(mgr, "2026-06-01");
  assert.equal(generated.length, 1);

  const invoice = await domain.get(mgr, "invoice", generated[0]);
  assert.equal(invoice.total, 1200); // 1000 + 20% tax
  assert.equal(invoice.status, "draft");

  const updatedPlan = await domain.get(mgr, "recurringPlan", plan.id);
  assert.equal(updatedPlan.nextRun, "2026-06-15"); // advanced one month from 2026-05-15

  // Running again is now a no-op (nextRun is in the future).
  const again = await fin.generateDueInvoices(mgr, "2026-06-01");
  assert.equal(again.length, 0);
});
