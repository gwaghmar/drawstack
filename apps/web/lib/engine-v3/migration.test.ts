import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";

describe("engine v2 to v3 migration", () => {
  it("preserves the v2 root content, IDs, ordering, and token values", () => {
    const result = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE));
    const sourceRoot = ENGINE_V2_SAMPLE.children[0];
    assert.equal(sourceRoot.type, "frame");
    if (sourceRoot.type !== "frame") throw new Error("Sample root must be a frame");
    assert.deepEqual(result.document.pages[0].root, sourceRoot);
    assert.deepEqual(result.document.pages[0].root.children.map((node) => node.id), sourceRoot.children.map((node) => node.id));
    assert.equal(result.document.tokens.colors.cobalt.value, ENGINE_V2_SAMPLE.tokens.colors.cobalt);
    assert.equal(result.audit.preservedNodeIds.includes("revenue-chart"), true);
  });

  it("is deterministic when the timestamp is supplied", () => {
    const source = structuredClone(ENGINE_V2_SAMPLE);
    assert.deepEqual(migrateV2ToV3(source, "2026-08-30T00:00:00.000Z"), migrateV2ToV3(source, "2026-08-30T00:00:00.000Z"));
  });

  it("retains every top-level node by wrapping non-canonical roots", () => {
    const source = structuredClone(ENGINE_V2_SAMPLE);
    const root = source.children[0];
    assert.equal(root.type, "frame");
    if (root.type !== "frame") return;
    source.children.push(structuredClone(root.children[0]));
    source.children[1].id = "extra-root";
    const result = migrateV2ToV3(source);
    assert.deepEqual(result.document.pages[0].root.children.map((node) => node.id), [root.id, "extra-root"]);
    assert.equal(result.audit.preservedNodeIds.includes("extra-root"), true);
  });
});
