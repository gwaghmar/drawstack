import assert from "node:assert/strict";
import test from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { createEngineV3PageView } from "./view-adapter.ts";
import { validateEngineV2Document } from "../engine-v2/compiler.ts";

test("adapts a resolved v3 page into the v2 renderer shape", () => {
  const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE), "2026-08-30T00:00:00.000Z").document;
  const view = createEngineV3PageView(document, document.pages[0].id);
  assert.equal(view.version, 2);
  assert.equal(view.children[0]?.type, "frame");
  assert.equal(view.artboard.background, "#F7F8F4");
  assert.equal(validateEngineV2Document(view).ok, true);
});

test("rejects an unknown page", () => {
  const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
  assert.throws(() => createEngineV3PageView(document, "missing"), /Unknown Engine v3 page/);
});
