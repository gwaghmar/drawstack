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
});
