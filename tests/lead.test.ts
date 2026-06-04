import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStack, makeCtx } from "./helpers";

test("lead: convert creates account, contact, deal and marks converted", async () => {
  const { domain } = buildStack();
  const mgr = makeCtx({ roles: ["sales_manager"], userId: "u_mgr" });

  const lead = await domain.create(mgr, "lead", {
    name: "Jane Doe",
    company: "Acme Test Co",
    email: "jane@acme.test",
    source: "web",
    status: "working",
  });

  const res = await domain.convertLead(mgr, lead.id);
  assert.ok(res.accountId && res.contactId && res.dealId);

  const updated = await domain.get(mgr, "lead", lead.id);
  assert.equal(updated.status, "converted");

  const account = await domain.get(mgr, "account", res.accountId);
  assert.equal(account.name, "Acme Test Co");

  const contact = await domain.get(mgr, "contact", res.contactId);
  assert.equal(contact.email, "jane@acme.test");

  await assert.rejects(() => domain.convertLead(mgr, lead.id), /already converted/);
});

test("lead: convert requires an email", async () => {
  const { domain } = buildStack();
  const mgr = makeCtx({ roles: ["sales_manager"], userId: "u_mgr" });
  const lead = await domain.create(mgr, "lead", { name: "No Email", company: "X Co", status: "working" });
  await assert.rejects(() => domain.convertLead(mgr, lead.id), /needs an email/);
});
