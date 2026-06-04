import { test } from "node:test";
import assert from "node:assert/strict";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/enforcement/errors";
import { buildStack, makeCtx } from "./helpers";

test("query engine: create, list and get a record", async () => {
  const { domain } = buildStack();
  const mgr = makeCtx({ roles: ["sales_manager"], userId: "u_mgr" });

  const created = await domain.create(mgr, "account", { name: "Acme Co" });
  assert.equal(created.name, "Acme Co");
  assert.equal(created.version, 1);
  assert.equal(created.ownerId, "u_mgr");

  const page = await domain.list(mgr, "account");
  assert.equal(page.total, 1);

  const got = await domain.get(mgr, "account", created.id);
  assert.equal(got.id, created.id);
});

test("query engine: rep is denied creating accounts (read-only policy)", async () => {
  const { domain } = buildStack();
  const rep = makeCtx({ roles: ["sales_rep"], userId: "u_rep" });
  await assert.rejects(() => domain.create(rep, "account", { name: "Nope" }), /not granted/);
});

test("query engine: tenant isolation hides other tenants' records", async () => {
  const { domain } = buildStack();
  const a = makeCtx({ roles: ["admin"], userId: "u_a", tenantId: "t_a", orgId: "o_a" });
  const b = makeCtx({ roles: ["admin"], userId: "u_b", tenantId: "t_b", orgId: "o_b" });

  const created = await domain.create(a, "account", { name: "Tenant A Co" });
  assert.equal((await domain.list(b, "account")).total, 0);
  await assert.rejects(() => domain.get(b, "account", created.id), NotFoundError);
});

test("query engine: ABAC blocks mutating another user's record", async () => {
  const { domain } = buildStack();
  const rep1 = makeCtx({ roles: ["sales_rep"], userId: "u_rep1" });
  const rep2 = makeCtx({ roles: ["sales_rep"], userId: "u_rep2" });

  const created = await domain.create(rep1, "deal", { name: "Rep1 Deal", amount: 100 });
  await assert.rejects(() => domain.update(rep2, "deal", created.id, { amount: 200 }), ForbiddenError);
  const ok = await domain.update(rep1, "deal", created.id, { amount: 200 });
  assert.equal(ok.amount, 200);
  assert.equal(ok.version, 2);
});

test("query engine: optimistic concurrency conflict", async () => {
  const { domain } = buildStack();
  const admin = makeCtx({ roles: ["admin"], userId: "u_admin" });
  const created = await domain.create(admin, "account", { name: "Versioned" });
  await assert.rejects(
    () => domain.update(admin, "account", created.id, { name: "New" }, 99),
    ConflictError,
  );
});

test("query engine: unique constraint enforced", async () => {
  const { domain } = buildStack();
  const admin = makeCtx({ roles: ["admin"], userId: "u_admin" });
  await domain.create(admin, "account", { name: "Dup Inc" });
  await assert.rejects(() => domain.create(admin, "account", { name: "Dup Inc" }), ConflictError);
});

test("query engine: field projection drops PII for rep", async () => {
  const { domain } = buildStack();
  const rep = makeCtx({ roles: ["sales_rep"], userId: "u_rep" });
  const created = await domain.create(rep, "contact", {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
  });
  assert.equal(created.firstName, "Ada");
  assert.equal(created.email, undefined, "rep must not see the PII email field");
});
