import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { applyEngineV3Command, type EngineV3CommandEnvelope } from "./commands.ts";

const envelope = (command: EngineV3CommandEnvelope["command"], baseRevision = 0): EngineV3CommandEnvelope => ({ id: "command-1", baseRevision, actor: "test", origin: "local", timestamp: "2026-08-31T00:00:00.000Z", command });

describe("engine-v3 command envelopes", () => {
  it("applies atomically and returns an inverse command", () => {
    const { document } = migrateV2ToV3(ENGINE_V2_SAMPLE);
    const pageId = document.pages[0].id;
    const result = applyEngineV3Command(document, 0, envelope({ kind: "node", action: "patch", pageId, nodeId: "title", changes: { name: "Renamed" }, precondition: { exists: true, type: "text", revision: 0 } }));
    assert.equal(result.ok, true);
    if (result.ok) { assert.equal(result.revision, 1); assert.equal(result.affectedIds[0], "title"); assert.equal(result.inverse.command.kind, "node"); }
  });
  it("rejects stale revisions and leaves document untouched", () => {
    const { document } = migrateV2ToV3(ENGINE_V2_SAMPLE);
    const result = applyEngineV3Command(document, 2, envelope({ kind: "tokens", tokens: document.tokens }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "revision-conflict");
  });
  it("returns structured precondition failures without partial application", () => {
    const { document } = migrateV2ToV3(ENGINE_V2_SAMPLE);
    const pageId = document.pages[0].id;
    const result = applyEngineV3Command(document, 0, envelope({ kind: "node", action: "remove", pageId, nodeId: "missing", precondition: { exists: true } }));
    assert.deepEqual(result, { ok: false, code: "missing-target", message: "Target does not exist", affectedIds: ["missing"] });
  });
  it("rejects commands that would violate document invariants", () => {
    const { document } = migrateV2ToV3(ENGINE_V2_SAMPLE);
    const pageId = document.pages[0].id;
    const result = applyEngineV3Command(document, 0, envelope({ kind: "page", action: "remove", page: { id: pageId } }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid-command");
  });
});
