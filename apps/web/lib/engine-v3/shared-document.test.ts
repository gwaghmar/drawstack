import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { serializeEngineV3Document } from "./serialization.ts";
import { parseSharedEngineV3Document } from "./shared-document.ts";

describe("shared Engine v3 documents", () => {
  it("accepts valid v3 project sources only", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    assert.equal(parseSharedEngineV3Document("engine-v2", serializeEngineV3Document(document))?.version, 3);
    assert.equal(parseSharedEngineV3Document("engine-v2", JSON.stringify(ENGINE_V2_SAMPLE)), null);
    assert.equal(parseSharedEngineV3Document("freeform", serializeEngineV3Document(document)), null);
  });
});
