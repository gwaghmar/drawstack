import assert from "node:assert/strict";
import test from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { resolveSharedDocumentAssets, portableAssetSource } from "./asset-sharing.ts";

test("resolves only assets referenced by the shared document", () => {
  const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
  const hash = "a".repeat(64); document.assets[hash] = { sha256: hash, mime: "image/png", source: "/private/asset" };
  document.pages[0].root.assetRef = hash;
  const result = resolveSharedDocumentAssets(document, new Map([[hash, document.assets[hash]]]));
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(Object.keys(result.assets), [hash]);
});

test("reports unavailable assets and refuses non-portable export sources", () => {
  const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
  const hash = "b".repeat(64); document.assets[hash] = { sha256: hash, mime: "image/png", source: "/private/asset" }; document.pages[0].root.assetRef = hash;
  const result = resolveSharedDocumentAssets(document, new Map()); assert.equal(result.ok, false);
  assert.throws(() => portableAssetSource(document.assets[hash]), /not embedded/);
});
