import { test } from "node:test";
import assert from "node:assert/strict";
import { MetadataRegistry, MetadataValidationError } from "@/lib/metadata/registry";
import { buildCreateSchema, validateRecord } from "@/lib/metadata/validation";
import { metadata } from "@/lib/metadata";
import type { EntityDef } from "@/lib/metadata/types";

test("metadata: rejects an invalid entity (enum without options)", () => {
  const reg = new MetadataRegistry();
  const bad = {
    name: "bad",
    label: "Bad",
    pluralLabel: "Bads",
    titleField: "x",
    fields: [{ name: "x", label: "X", type: "enum" }],
  } as unknown as EntityDef;
  assert.throws(() => reg.createDraft([bad]), MetadataValidationError);
});

test("metadata: rejects reference to unknown entity", () => {
  const reg = new MetadataRegistry();
  const e = {
    name: "thing",
    label: "Thing",
    pluralLabel: "Things",
    titleField: "name",
    fields: [
      { name: "name", label: "Name", type: "string" },
      { name: "ref", label: "Ref", type: "reference", referenceEntity: "ghost" },
    ],
  } as unknown as EntityDef;
  assert.throws(() => reg.createDraft([e]), MetadataValidationError);
});

test("metadata: resolver exposes published CRM entities", () => {
  assert.equal(metadata.getEntity("deal").name, "deal");
  assert.ok(metadata.listEntities().length >= 4);
  assert.ok(metadata.getLifecycle("deal"));
});

test("metadata: create schema honors required + defaults", () => {
  const schema = buildCreateSchema(metadata.getEntity("deal"));
  assert.equal(validateRecord(schema, {}).success, false, "missing required name should fail");
  assert.equal(validateRecord(schema, { name: "Big deal" }).success, true, "stage default applies");
});
