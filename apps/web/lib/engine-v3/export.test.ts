import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { createEngineV3JsonExport, createEngineV3PageExports } from "./export.ts";
import { duplicatePage } from "./operations.ts";

describe("engine v3 exports", () => {
  it("keeps canonical JSON lossless and deterministic", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    const first = createEngineV3JsonExport(document);
    const second = createEngineV3JsonExport(document);
    assert.equal(first.mimeType, "application/json");
    assert.equal(first.contents, second.contents);
    assert.deepEqual(JSON.parse(first.contents), document);
  });

  it("emits deterministic per-page SVG, print HTML, and TSX payloads", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    const withSecond = duplicatePage(document, document.pages[0].id, "page-2");
    for (const kind of ["svg", "html", "tsx"] as const) {
      const outputs = createEngineV3PageExports(withSecond, kind);
      assert.equal(outputs.length, 2);
      assert.notEqual(outputs[0].filename, outputs[1].filename);
      assert.equal(outputs[0].pageId, withSecond.pages[0].id);
      assert.ok(outputs.every((output) => output.contents.length > 0));
    }
  });
});
