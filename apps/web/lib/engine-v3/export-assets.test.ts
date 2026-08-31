import assert from "node:assert/strict";
import test from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { inlineEngineV3Assets } from "./export.ts";

test("inlines assets into an ephemeral clone and leaves canonical source unchanged", async () => {
  const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
  const hash = "a".repeat(64); document.assets[hash] = { sha256: hash, mime: "image/png", source: "/private" }; document.pages[0].root.assetRef = hash;
  const embedded = await inlineEngineV3Assets(document, async () => "data:image/png;base64,AAAA");
  assert.equal(embedded.assets[hash].source, "data:image/png;base64,AAAA");
  assert.equal(document.assets[hash].source, "/private");
});

test("fails honestly when the asset cannot be read", async () => {
  const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
  const hash = "b".repeat(64); document.assets[hash] = { sha256: hash, mime: "image/png", source: "/private" }; document.pages[0].root.assetRef = hash;
  await assert.rejects(() => inlineEngineV3Assets(document, async () => null), /unavailable/);
});
