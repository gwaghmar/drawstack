import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_V2_SAMPLE } from "./engine-v2/document.ts";
import { migrateV2ToV3 } from "./engine-v3/migration.ts";
import { parseEngineSource } from "./engine-document-source.ts";

describe("engine document source", () => {
  it("preserves valid v2 documents for existing editors", () => {
    const result = parseEngineSource(JSON.stringify(ENGINE_V2_SAMPLE));
    assert.equal(result.version, 2);
    assert.equal(JSON.parse(result.source).version, 2);
  });

  it("normalizes valid v3 documents canonically", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    const result = parseEngineSource(JSON.stringify(document));
    assert.equal(result.version, 3);
    assert.equal(parseEngineSource(result.source).source, result.source);
  });

  it("rejects malformed and unsupported documents", () => {
    assert.throws(() => parseEngineSource("broken"), /valid JSON/);
    assert.throws(() => parseEngineSource('{"version":3,"engine":"dom-css"}'), /metadata|pages|token/i);
  });
});
