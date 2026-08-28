import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_V2_SAMPLE } from "./document.ts";
import { parseSharedEngineV2Document } from "./shared-document.ts";

describe("parseSharedEngineV2Document", () => {
  it("accepts a validated Engine v2 document", () => {
    const result = parseSharedEngineV2Document("engine-v2", JSON.stringify(ENGINE_V2_SAMPLE));
    assert.equal(result?.engine, "dom-css");
  });

  it("fails closed for malformed, invalid, and legacy sources", () => {
    assert.equal(parseSharedEngineV2Document("engine-v2", "{broken"), null);
    assert.equal(parseSharedEngineV2Document("engine-v2", JSON.stringify({ version: 2, engine: "dom-css" })), null);
    assert.equal(parseSharedEngineV2Document("freeform", JSON.stringify(ENGINE_V2_SAMPLE)), null);
  });
});
