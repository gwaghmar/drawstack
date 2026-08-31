import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EngineNode } from "./document.ts";
import { groupNodes, ungroupNode } from "./grouping.ts";

const text = (id: string, locked = false): EngineNode => ({ id, name: id, type: "text", content: id, variant: "body", locked });

describe("engine-v2 grouping", () => {
  it("groups sibling nodes at the first selected position and ungroups losslessly", () => {
    const source = [text("a"), text("b"), text("c")];
    const grouped = groupNodes(source, ["b", "c"], "group");
    assert.deepEqual(grouped.map((node) => node.id), ["a", "group"]);
    assert.deepEqual((grouped[1] as Extract<EngineNode, { type: "frame" }>).children.map((node) => node.id), ["b", "c"]);
    assert.deepEqual(ungroupNode(grouped, "group").map((node) => node.id), ["a", "b", "c"]);
  });
  it("requires siblings and never groups locked nodes", () => {
    const source: EngineNode[] = [text("a"), text("b", true), { id: "frame", name: "frame", type: "frame", layout: { mode: "flex" as const, gap: 0, padding: 0 }, children: [text("c")] }];
    assert.equal(groupNodes(source, ["a", "b"], "group"), source);
    assert.equal(groupNodes(source, ["a", "c"], "group"), source);
  });
  it("does not ungroup a locked frame", () => {
    const group = { id: "group", name: "group", type: "frame" as const, locked: true, layout: { mode: "flex" as const, gap: 0, padding: 0 }, children: [text("a"), text("b")] };
    const source: EngineNode[] = [group];
    assert.equal(ungroupNode(source, "group"), source);
  });
  it("rejects a group id that already exists anywhere in the tree", () => {
    const source: EngineNode[] = [text("a"), text("b"), { id: "frame", name: "frame", type: "frame", layout: { mode: "flex", gap: 0, padding: 0 }, children: [text("group")] }];
    assert.equal(groupNodes(source, ["a", "b"], "group"), source);
  });
});
