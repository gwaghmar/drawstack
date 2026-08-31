import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { validateEngineV3Document } from "./compiler.ts";
import { migrateV2ToV3 } from "./migration.ts";
import {
  duplicateEngineV3Subtree,
  findEngineV3Node,
  groupEngineV3Nodes,
  insertEngineV3Node,
  patchEngineV3Node,
  removeEngineV3Node,
  ungroupEngineV3Node,
} from "./node-operations.ts";

const base = () => migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;

describe("engine v3 node operations", () => {
  it("finds, patches, removes, and restores nested nodes immutably", () => {
    const document = base();
    const pageId = document.pages[0].id;
    const location = findEngineV3Node(document, pageId, "title");
    assert.equal(location?.parentId, "title-stack");
    const patched = patchEngineV3Node(document, pageId, "title", { name: "Edited title", transform: { x: 12, y: 8 } });
    assert.equal(findEngineV3Node(patched, pageId, "title")?.node.name, "Edited title");
    assert.equal(findEngineV3Node(document, pageId, "title")?.node.name, "Report title");
    const removed = removeEngineV3Node(patched, pageId, "title");
    assert.equal(findEngineV3Node(removed.document, pageId, "title"), null);
    const restored = insertEngineV3Node(removed.document, pageId, removed.removed.parentId, removed.removed.node, removed.removed.index);
    assert.deepEqual(restored, patched);
  });
  it("updates nodes directly under the page root", () => {
    const document = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
    const pageId = document.pages[0].id;
    const patched = patchEngineV3Node(document, pageId, "header", { transform: { x: 24, y: 12 } });
    assert.deepEqual(findEngineV3Node(patched, pageId, "header")?.node.transform, { x: 24, y: 12 });
  });

  it("groups and ungroups siblings without losing their order", () => {
    const document = base();
    const pageId = document.pages[0].id;
    const frame = { id: "metrics-group", name: "Metrics group", type: "frame" as const, layout: { mode: "flex" as const, direction: "row" as const, gap: 0, padding: 0 }, children: [] };
    const grouped = groupEngineV3Nodes(document, pageId, ["mrr", "retention"], frame);
    const group = findEngineV3Node(grouped, pageId, frame.id)?.node;
    assert.equal(group?.type, "frame");
    if (group?.type !== "frame") return;
    assert.deepEqual(group.children.map((node) => node.id), ["mrr", "retention"]);
    const ungrouped = ungroupEngineV3Node(grouped, pageId, frame.id);
    assert.deepEqual(ungrouped, document);
  });

  it("uses globally fresh IDs and respects root locks", () => {
    const document = base();
    const pageId = document.pages[0].id;
    const duplicated = duplicateEngineV3Subtree(document, pageId, "title-stack", "copy");
    assert.equal(validateEngineV3Document(duplicated).ok, true);
    const locked = patchEngineV3Node(document, pageId, document.pages[0].root.id, { locked: true });
    assert.throws(() => patchEngineV3Node(locked, pageId, "title", { name: "Blocked" }), /locked/);
    assert.throws(() => insertEngineV3Node(locked, pageId, null, { id: "new-node", name: "New", type: "text", content: "New", variant: "body" }), /locked/);
    assert.equal(patchEngineV3Node(locked, pageId, document.pages[0].root.id, { locked: false }).pages[0].root.locked, false);
  });
});
