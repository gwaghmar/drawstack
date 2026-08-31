import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { commandAffectedIds, reconcileRemoteCommand } from "./reconciliation.ts";
import type { EngineV3CommandEnvelope } from "./commands.ts";

const env = (command: EngineV3CommandEnvelope["command"], baseRevision = 0, id = "c"): EngineV3CommandEnvelope => ({ id, baseRevision, actor: "remote", origin: "local", timestamp: "2026-08-31T00:00:00.000Z", command });

describe("engine v3 reconciliation", () => {
  it("applies current-base commands and identifies nested batch targets", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    const pageId = document.pages[0].id;
    const command = { kind: "node", action: "patch", pageId, nodeId: "title", changes: { name: "Updated" } } as const;
    const result = reconcileRemoteCommand(document, 0, env(command));
    assert.equal(result.kind, "applied");
    assert.deepEqual(commandAffectedIds({ kind: "batch", commands: [command, { kind: "tokens", tokens: document.tokens }] }), ["title", "tokens"]);
  });

  it("returns an explicit conflict for stale overlapping commands", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    const pageId = document.pages[0].id;
    const command = { kind: "node", action: "patch", pageId, nodeId: "title", changes: { name: "Remote" } } as const;
    const result = reconcileRemoteCommand(document, 2, env(command, 0), [env(command, 0, "local")]);
    assert.deepEqual(result.kind, "conflict");
    if (result.kind === "conflict") assert.deepEqual(result.affectedIds, ["title"]);
  });

  it("rebases stale commands when their targets do not overlap local work", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    const pageId = document.pages[0].id;
    const incoming = env({ kind: "node", action: "patch", pageId, nodeId: "title", changes: { name: "Remote" } }, 0);
    const local = env({ kind: "node", action: "patch", pageId, nodeId: "mrr", changes: { name: "Local" } }, 0, "local");
    const result = reconcileRemoteCommand(document, 2, incoming, [local]);
    assert.equal(result.kind, "applied");
    if (result.kind === "applied") assert.equal(result.result.revision, 3);
  });
});
