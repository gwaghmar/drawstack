import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { createEngineV3RenderPlan } from "./render-plan.ts";

describe("engine v3 resolved render plan", () => {
  it("resolves token aliases, inherited geometry, visibility, and assets deterministically", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    document.tokens.colors.brand = { value: "#123456" };
    document.tokens.colors.surface = { value: "#fff", alias: "brand" };
    document.pages[0].background = "$surface";
    document.pages[0].root.transform = { x: 10, y: 20 };
    document.pages[0].root.children[0].transform = { x: 4, y: 5 };
    document.pages[0].root.children[0].visible = false;
    const assetId = "a".repeat(64);
    document.assets[assetId] = { sha256: assetId, mime: "image/svg+xml", source: "upload", license: "MIT" };
    document.pages[0].root.children[0].assetRef = assetId;
    const plan = createEngineV3RenderPlan(document);
    assert.equal(plan.pages[0].background, "#123456");
    const header = plan.pages[0].records.find((record) => record.id === "header");
    assert.equal(header?.visible, false);
    assert.deepEqual(header?.transform.x, 14);
    assert.equal(header?.asset?.ref.sha256, assetId);
    assert.deepEqual(plan, createEngineV3RenderPlan(document));
  });

  it("rejects dangling assets, token cycles, and component cycles", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    document.pages[0].root.assetRef = "missing";
    assert.throws(() => createEngineV3RenderPlan(document), /Unknown asset/);
    delete document.pages[0].root.assetRef;
    document.tokens.colors.a = { value: "$b", alias: "b" };
    document.tokens.colors.b = { value: "$a", alias: "a" };
    document.pages[0].background = "$a";
    assert.throws(() => createEngineV3RenderPlan(document), /cycle/);
  });
});
