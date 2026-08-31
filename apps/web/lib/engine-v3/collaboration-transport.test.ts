import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { EngineV3CollaborationSession, type EngineV3Transport } from "./collaboration-transport.ts";
import type { EngineV3CommandEnvelope } from "./commands.ts";

describe("engine v3 collaboration transport adapter", () => {
  it("publishes envelopes and applies subscribed remotes through the controller", async () => {
    let receive: ((envelope: EngineV3CommandEnvelope) => void) | null = null;
    const published: EngineV3CommandEnvelope[] = [];
    const transport: EngineV3Transport = { publish: async (envelope) => { published.push(envelope); }, subscribe: (callback) => { receive = callback; return () => { receive = null; }; } };
    const session = new EngineV3CollaborationSession(migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document, transport);
    session.connect();
    const pageId = session.snapshot().document.pages[0].id;
    await session.submit({ kind: "node", action: "patch", pageId, nodeId: "title", changes: { name: "Local" } }, "me");
    assert.equal(published.length, 1);
    const callback = receive as ((envelope: EngineV3CommandEnvelope) => void) | null;
    if (callback) callback({ ...published[0], id: "remote", actor: "other", baseRevision: 1, command: { kind: "node", action: "patch", pageId, nodeId: "mrr", changes: { name: "Remote" } } });
    assert.equal(session.snapshot().revision, 2);
    session.disconnect();
  });
});
