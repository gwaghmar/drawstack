import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { EngineV3HistoryController } from "./history.ts";
import { EngineV3CollaborationController } from "./collaboration-controller.ts";
import { serializeEngineV3Document } from "./serialization.ts";
import { parseEngineV3CommandEnvelope } from "./collaboration-envelope.ts";
import { createEngineV3AgentReadView, parseEngineV3AgentModelText, parseEngineV3AgentProposal } from "./agent-proposal.ts";
import { findEngineV3Node } from "./node-operations.ts";

describe("engine v3 agent-native invariants", () => {
  it("preserves untouched nodes and records a targeted batch as one undo step", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    const pageId = document.pages[0].id;
    const history = new EngineV3HistoryController(document);
    history.apply({ kind: "batch", commands: [{ kind: "node", action: "patch", pageId, nodeId: "title", changes: { content: "Agent update" } }] }, "ai", "agent", "agent-1");
    const changed = history.snapshot();
    assert.equal(changed.canUndo, true);
    assert.equal(changed.document.pages[0].root.children.find((node) => node.id === "metrics")?.name, document.pages[0].root.children.find((node) => node.id === "metrics")?.name);
    history.undo();
    assert.equal(serializeEngineV3Document(history.snapshot().document), serializeEngineV3Document(document));
  });

  it("keeps remote edits outside local undo history", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    const pageId = document.pages[0].id;
    const controller = new EngineV3CollaborationController(document);
    controller.applyRemote({ id: "remote-1", actor: "other", origin: "local", baseRevision: 0, timestamp: "2026-08-31T00:00:00.000Z", command: { kind: "node", action: "patch", pageId, nodeId: "title", changes: { content: "Remote" } } });
    assert.equal(controller.snapshot().pending.length, 0);
  });

  it("rejects malformed model envelopes with structured null diagnostics", () => {
    assert.equal(parseEngineV3CommandEnvelope({ id: "agent", actor: "agent", origin: "ai", baseRevision: 0, timestamp: "bad", command: { kind: "node", action: "remove", pageId: "page", nodeId: "title" } }), null);
  });

  it("limits safe mode to selected presentation patches and returns a validated preview", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    const pageId = document.pages[0].id;
    const result = parseEngineV3AgentProposal({ commands: [{ kind: "node", action: "patch", pageId, nodeId: "title", changes: { content: "Focused update" } }], explanation: "Updated the title" }, document, 0, ["title"], true, "agent");
    assert.equal(result.ok, true);
    if (result.ok) {
      const previewTitle = findEngineV3Node(result.proposal.preview, pageId, "title")?.node;
      const originalTitle = findEngineV3Node(document, pageId, "title")?.node;
      assert.equal(previewTitle?.type, "text");
      assert.equal(originalTitle?.type, "text");
      if (previewTitle?.type === "text" && originalTitle?.type === "text") {
        assert.equal(previewTitle.content, "Focused update");
        assert.notEqual(originalTitle.content, "Focused update");
      }
    }
    const blocked = parseEngineV3AgentProposal({ commands: [{ kind: "node", action: "remove", pageId, nodeId: "title" }] }, document, 0, ["title"], true, "agent");
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.match(blocked.diagnostics[0].suggestion, /Select|patch/i);
    const unsafeStyle = parseEngineV3AgentProposal({ commands: [{ kind: "node", action: "patch", pageId, nodeId: "title", changes: { style: { background: "url(https://tracker.example/pixel)" } } }] }, document, 0, ["title"], true, "agent");
    assert.equal(unsafeStyle.ok, false);
    const asset = "a".repeat(64);
    const assetChange = parseEngineV3AgentProposal({ commands: [{ kind: "asset", action: "define", asset: { sha256: asset, mime: "image/png", source: "https://example.com/image.png" } }] }, document, 0, [], false, "agent");
    assert.equal(assetChange.ok, false);
  });

  it("creates a compact selected read view and extracts fenced model JSON", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    const view = createEngineV3AgentReadView(document, ["title"]);
    assert.deepEqual(view.selected.map((item) => item.node.id), ["title"]);
    assert.equal(view.selected[0].pageId, document.pages[0].id);
    assert.deepEqual(parseEngineV3AgentModelText('```json\n{"commands":[],"explanation":"x"}\n```'), { commands: [], explanation: "x" });
  });
});
