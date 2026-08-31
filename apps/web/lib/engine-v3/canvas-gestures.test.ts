import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { dragEngineV3Node, resizeEngineV3Node } from "./canvas-gestures.ts";
import { findEngineV3Node } from "./node-operations.ts";

describe("engine v3 canvas gestures", () => {
  it("does not snap a moving frame to its own descendants", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    const pageId = document.pages[0].id;
    const result = dragEngineV3Node(document, pageId, "header", 48, 32);
    const transform = findEngineV3Node(result.document, pageId, "header")?.node.transform;
    assert.deepEqual({ x: transform?.x, y: transform?.y }, { x: 48, y: 32 });
  });

  it("bounds resize dimensions and rejects locked edits", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    const pageId = document.pages[0].id;
    const resized = resizeEngineV3Node(document, pageId, "title", -10, 0);
    const style = findEngineV3Node(resized.document, pageId, "title")?.node.style;
    assert.deepEqual({ width: style?.width, minHeight: style?.minHeight }, { width: 1, minHeight: 1 });
    const title = findEngineV3Node(document, pageId, "title")!; title.node.locked = true;
    assert.throws(() => dragEngineV3Node(document, pageId, "title", 10, 10), /locked/);
  });

  it("supports dragging flow children without changing their parent or identity", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    const pageId = document.pages[0].id;
    const before = findEngineV3Node(document, pageId, "mrr")!;
    const result = dragEngineV3Node(document, pageId, "mrr", 120, 80);
    const after = findEngineV3Node(result.document, pageId, "mrr")!;
    assert.equal(after.parentId, before.parentId);
    assert.equal(after.node.id, before.node.id);
    assert.deepEqual(after.node.transform, { x: 120, y: 80 });
  });

  it("resizes width and height independently", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    const pageId = document.pages[0].id;
    const widthOnly = resizeEngineV3Node(document, pageId, "mrr", 240);
    assert.equal(findEngineV3Node(widthOnly.document, pageId, "mrr")?.node.style?.width, 240);
    assert.equal(findEngineV3Node(widthOnly.document, pageId, "mrr")?.node.style?.minHeight, undefined);
    const both = resizeEngineV3Node(document, pageId, "mrr", 240, 180);
    assert.deepEqual(findEngineV3Node(both.document, pageId, "mrr")?.node.style, { width: 240, minHeight: 180 });
  });
});
