import assert from "node:assert/strict";
import test from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { isSharedInlineImageMime, referencedEngineV3AssetIds, resolveSharedDocumentAssets, portableAssetSource } from "./asset-sharing.ts";

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

test("returns only referenced assets and permits only safe inline image MIME types", () => {
  const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
  const used = "c".repeat(64); const unused = "d".repeat(64);
  document.assets[used] = { sha256: used, mime: "image/png", source: "/private/used" };
  document.assets[unused] = { sha256: unused, mime: "image/png", source: "/private/unused" };
  document.pages[0].root.assetRef = used;
  assert.deepEqual(referencedEngineV3AssetIds(document), [used]);
  assert.equal(isSharedInlineImageMime("image/png"), true);
  assert.equal(isSharedInlineImageMime("application/pdf"), false);
});
