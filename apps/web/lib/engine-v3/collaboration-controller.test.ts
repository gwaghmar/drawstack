import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { EngineV3CollaborationController } from "./collaboration-controller.ts";
import type { EngineV3CommandEnvelope } from "./commands.ts";

const remote = (command: EngineV3CommandEnvelope["command"], id: string, baseRevision: number): EngineV3CommandEnvelope => ({ id, baseRevision, actor: "remote", origin: "local", timestamp: "2026-08-31T00:00:00.000Z", command });

describe("engine v3 collaboration controller", () => {
  it("tracks local pending commands and acknowledges them", () => {
    const controller = new EngineV3CollaborationController(migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document);
    const pageId = controller.snapshot().document.pages[0].id;
    controller.submit({ kind: "node", action: "patch", pageId, nodeId: "title", changes: { name: "Local" } }, "me", "local", "local-1", "2026-08-31T00:00:00.000Z");
    assert.deepEqual(controller.snapshot().pending.map((entry) => entry.id), ["local-1"]);
    controller.acknowledge("local-1", 1);
    assert.equal(controller.snapshot().pending.length, 0);
  });

  it("applies independent remotes and exposes overlapping conflicts", () => {
    const controller = new EngineV3CollaborationController(migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document);
    const pageId = controller.snapshot().document.pages[0].id;
    const local = { kind: "node", action: "patch", pageId, nodeId: "title", changes: { name: "Local" } } as const;
    controller.submit(local, "me", "local", "local-1", "2026-08-31T00:00:00.000Z");
    controller.applyRemote(remote({ kind: "node", action: "patch", pageId, nodeId: "mrr", changes: { name: "Remote" } }, "remote-1", 0));
    assert.equal(controller.snapshot().revision, 2);
    controller.applyRemote(remote(local, "remote-2", 0));
    assert.equal(controller.snapshot().conflicts[0].reason, "overlapping-target");
  });
});
