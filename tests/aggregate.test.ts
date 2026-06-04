import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStack, makeCtx } from "./helpers";

test("aggregate: sum + count grouped by stage", async () => {
  const { domain } = buildStack();
  const mgr = makeCtx({ roles: ["sales_manager"], userId: "u_mgr" });

  await domain.create(mgr, "deal", { name: "A", amount: 100, stage: "qualified" });
  await domain.create(mgr, "deal", { name: "B", amount: 200, stage: "qualified" });
  await domain.create(mgr, "deal", { name: "C", amount: 500, stage: "won" });

  const rows = await domain.aggregate(mgr, "deal", {
    groupBy: "stage",
    measures: [
      { op: "sum", field: "amount", as: "total" },
      { op: "count", as: "n" },
    ],
  });

  const byStage = Object.fromEntries(rows.map((r) => [r.key, r.measures]));
  assert.equal(byStage.qualified.total, 300);
  assert.equal(byStage.qualified.n, 2);
  assert.equal(byStage.won.total, 500);
  assert.equal(byStage.won.n, 1);
});

test("aggregate: respects tenant isolation", async () => {
  const { domain } = buildStack();
  const a = makeCtx({ roles: ["admin"], userId: "u_a", tenantId: "t_a", orgId: "o_a" });
  const b = makeCtx({ roles: ["admin"], userId: "u_b", tenantId: "t_b", orgId: "o_b" });
  await domain.create(a, "deal", { name: "A", amount: 100, stage: "won" });
  const rows = await domain.aggregate(b, "deal", { measures: [{ op: "sum", field: "amount", as: "total" }] });
  const total = rows[0]?.measures.total ?? 0;
  assert.equal(total, 0);
});
