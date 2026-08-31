import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { createEngineV3JsonExport, createEngineV3PageExports, inlineEngineV3Assets } from "./export.ts";
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

  it("preserves authored transforms and embedded asset sources across portable exports", async () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    const title = document.pages[0].root.children.find((node) => node.id === "header")!;
    title.transform = { x: 40, y: 24, rotation: 18 };
    const assetId = "a".repeat(64);
    document.assets[assetId] = { sha256: assetId, mime: "image/png", source: "/api/engine-v3/assets?sha256=" + assetId };
    const image = { id: "portable-image", name: "Portable image", type: "image" as const, assetRef: assetId, alt: "Portable", style: { width: 120 } };
    document.pages[0].root.children.push(image);
    const portable = await inlineEngineV3Assets(document, async () => "data:image/png;base64,AAAA");
    const svg = createEngineV3PageExports(portable, "svg")[0];
    const tsx = createEngineV3PageExports(portable, "tsx")[0];
    assert.deepEqual(svg.warnings, []);
    assert.equal(svg.contents.includes("foreignObject"), false);
    assert.match(svg.contents, /<rect width="100%" height="100%"/);
    assert.match(svg.contents, /rotate\(18 /);
    assert.match(svg.contents, /data:image\/png;base64,AAAA/);
    assert.match(tsx.contents, /rotate\(18deg\)/);
    assert.match(tsx.contents, /data:image\/png;base64,AAAA/);
  });
});
