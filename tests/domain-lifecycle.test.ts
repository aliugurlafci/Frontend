import { test } from "node:test";
import assert from "node:assert/strict";
import { ConflictError, ForbiddenError } from "@/lib/enforcement/errors";
import type { DomainEvent } from "@/lib/workflow/event-bus";
import { buildStack, makeCtx } from "./helpers";

test("lifecycle: manager wins a deal, emits event, records audit", async () => {
  const { domain, bus } = buildStack();
  const mgr = makeCtx({ roles: ["sales_manager"], userId: "u_mgr" });

  const events: DomainEvent[] = [];
  bus.subscribe("deal.win", (e) => {
    events.push(e);
  });

  const deal = await domain.create(mgr, "deal", { name: "Win me", amount: 5000, stage: "negotiation" });
  const won = await domain.transition(mgr, "deal", deal.id, "win");

  assert.equal(won.stage, "won");
  assert.equal(events.length, 1, "deal.win event should be published");

  const trail = domain.auditTrail(mgr, "deal", deal.id);
  assert.ok(trail.some((e) => e.action === "transition" && e.to === "won"));
});

test("lifecycle: rep cannot win a deal (action permission)", async () => {
  const { domain } = buildStack();
  const rep = makeCtx({ roles: ["sales_rep"], userId: "u_rep" });
  const deal = await domain.create(rep, "deal", { name: "Rep deal", amount: 1000, stage: "negotiation" });
  await assert.rejects(() => domain.transition(rep, "deal", deal.id, "win"), ForbiddenError);
});

test("lifecycle: invariant blocks winning a zero-amount deal", async () => {
  const { domain } = buildStack();
  const mgr = makeCtx({ roles: ["sales_manager"], userId: "u_mgr" });
  const deal = await domain.create(mgr, "deal", { name: "Empty", amount: 0, stage: "negotiation" });
  await assert.rejects(() => domain.transition(mgr, "deal", deal.id, "win"), ConflictError);
});

test("lifecycle: illegal transition is rejected", async () => {
  const { domain } = buildStack();
  const mgr = makeCtx({ roles: ["sales_manager"], userId: "u_mgr" });
  const deal = await domain.create(mgr, "deal", { name: "Fresh", amount: 10, stage: "lead" });
  // cannot win directly from lead
  await assert.rejects(() => domain.transition(mgr, "deal", deal.id, "win"), ConflictError);
});
