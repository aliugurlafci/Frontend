import { test } from "node:test";
import assert from "node:assert/strict";
import { permissionEngine } from "@/lib/permissions/engine";
import { makeCtx } from "./helpers";

const admin = makeCtx({ roles: ["admin"], userId: "u_admin" });
const rep = makeCtx({ roles: ["sales_rep"], userId: "u_rep" });

test("permissions: admin may win deals, rep may not", () => {
  assert.equal(permissionEngine.can(admin, { action: "deal:win", entity: "deal" }), true);
  assert.equal(permissionEngine.can(rep, { action: "deal:win", entity: "deal" }), false);
});

test("permissions: ABAC — rep may update own record but not another's", () => {
  assert.equal(
    permissionEngine.can(rep, { action: "deal:update", entity: "deal", recordOwnerId: "u_rep" }),
    true,
  );
  const denied = permissionEngine.evaluate(rep, {
    action: "deal:update",
    entity: "deal",
    recordOwnerId: "someone_else",
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.code, "abac_denied");
});

test("permissions: field-level — PII denied for rep, allowed for admin", () => {
  const repPii = permissionEngine.evaluate(rep, {
    action: "contact:read",
    entity: "contact",
    field: "email",
    fieldPii: true,
  });
  assert.equal(repPii.allowed, false);
  assert.equal(repPii.code, "field_denied");

  assert.equal(
    permissionEngine.can(admin, { action: "contact:read", entity: "contact", field: "email", fieldPii: true }),
    true,
  );
});
