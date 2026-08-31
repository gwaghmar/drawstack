import assert from "node:assert/strict";
import test from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { parseEngineV3Source, serializeEngineV3Document } from "./serialization.ts";

test("serializes with deterministic key ordering", () => {
  const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE), "2026-08-30T00:00:00.000Z").document;
  const first = serializeEngineV3Document(document);
  const parsed = parseEngineV3Source(first);
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.canonicalSource, first);
});

test("parses v3 and migrates valid v2 with an audit", () => {
  const v2 = JSON.stringify(ENGINE_V2_SAMPLE);
  const migrated = parseEngineV3Source(v2);
  assert.equal(migrated.ok, true);
  if (migrated.ok) { assert.equal(migrated.sourceVersion, "v2"); assert.equal(migrated.audit?.from, 2); }
  const v3 = migrated.ok ? parseEngineV3Source(migrated.canonicalSource) : migrated;
  assert.equal(v3.ok, true);
  if (v3.ok) assert.equal(v3.sourceVersion, "v3");
});

test("rejects legacy freeform and malformed or unsupported input", () => {
  assert.equal(parseEngineV3Source('{"version":1,"engine":"freeform"}').version, "legacy-freeform");
  assert.equal(parseEngineV3Source("not json").ok, false);
  assert.equal(parseEngineV3Source('{"version":99,"engine":"dom-css"}').version, "unknown");
  assert.equal(parseEngineV3Source('{"version":2,"engine":"dom-css"}').ok, false);
});
