import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEngineV3CommandEnvelope } from "./collaboration-envelope.ts";

describe("engine v3 collaboration envelope", () => {
  it("accepts bounded envelopes and nested batches", () => {
    const value = { id: "c-1", actor: "user-1", origin: "local", baseRevision: 2, timestamp: "2026-08-31T00:00:00.000Z", command: { kind: "batch", commands: [{ kind: "tokens", tokens: {} }] } };
    assert.equal(parseEngineV3CommandEnvelope(value)?.id, "c-1");
  });
  it("rejects malformed or unsafe envelopes", () => {
    assert.equal(parseEngineV3CommandEnvelope({ id: "x", actor: "u", origin: "local", baseRevision: -1, timestamp: "2026-08-31", command: {} }), null);
    assert.equal(parseEngineV3CommandEnvelope({ id: "x", actor: "u", origin: "local", baseRevision: 0, timestamp: "2026-08-31T00:00:00.000Z", command: { kind: "node", pageId: "p", action: "remove" } }), null);
  });
});
