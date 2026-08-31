import assert from "node:assert/strict";
import test from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { validateEngineV3Document } from "./compiler.ts";

test("accepts a migrated v2 document", () => {
  const result = validateEngineV3Document(migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document);
  assert.equal(result.ok, true);
});

test("rejects duplicate ids, unsafe values, and dangling assets", () => {
  const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
  const root = document.pages[0].root;
  const child = root.children[0];
  root.children.push({ ...child, id: "duplicate" }, { ...child, id: "duplicate", name: "<unsafe>" });
  (root.children[0] as Record<string, unknown>).assetRef = "missing";
  (root.children[0] as Record<string, unknown>).opacity = 2;
  const result = validateEngineV3Document(document);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.issues.some((issue) => issue.message === "Duplicate node id"), true);
  assert.equal(result.issues.some((issue) => issue.message === "Unknown asset"), true);
  assert.equal(result.issues.some((issue) => issue.message === "Opacity must be 0..1"), true);
});

test("rejects token aliases outside their typed set", () => {
  const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
  document.tokens.colors.ink.alias = "12px";
  const result = validateEngineV3Document(document);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.issues.some((issue) => issue.path.includes("tokens.colors.ink.alias")), true);
});

test("rejects token alias and component reference cycles", () => {
  const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
  document.tokens.colors.first = { value: "#000", alias: "second" };
  document.tokens.colors.second = { value: "#fff", alias: "first" };
  const root = document.pages[0].root;
  document.components.a = { id: "a", name: "A", root: { ...root, id: "a-root", componentRef: "b", children: [] }, slots: [], variants: {} };
  document.components.b = { id: "b", name: "B", root: { ...root, id: "b-root", componentRef: "a", children: [] }, slots: [], variants: {} };
  const result = validateEngineV3Document(document);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.issues.some((issue) => issue.message === "Token alias cycle"), true);
  assert.equal(result.issues.some((issue) => issue.message === "Component cycle"), true);
});
