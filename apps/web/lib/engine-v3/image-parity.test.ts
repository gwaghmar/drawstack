import assert from "node:assert/strict";
import test from "node:test";
import { createEngineV2PrintHtmlExport, createEngineV2ReactTsxExport, createEngineV2SvgExport } from "../engine-v2/export.ts";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { createEngineV3PageView } from "./view-adapter.ts";

test("image asset survives shared view and all exports", () => {
  const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
  const assetId = "a".repeat(64); document.assets[assetId] = { sha256: assetId, mime: "image/png", source: "https://cdn.example.test/hero.png" };
  const root = document.pages[0].root; root.children.push({ id: "hero", name: "Hero", type: "image", assetRef: assetId, alt: "Hero" });
  const view = createEngineV3PageView(document, document.pages[0].id);
  const image = view.children[0]?.type === "frame" ? view.children[0].children.at(-1) : undefined; assert.equal(image?.type, "image");
  if (image?.type !== "image") return;
  assert.equal(image.src, "https://cdn.example.test/hero.png");
  assert.match(createEngineV2SvgExport(view).contents, /hero\.png/);
  assert.match(createEngineV2PrintHtmlExport(view).contents, /hero\.png/);
  assert.match(createEngineV2ReactTsxExport(view).contents, /hero\.png/);
});
