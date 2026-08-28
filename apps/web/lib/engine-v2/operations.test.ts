import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EngineNode } from "./document.ts";
import {
  duplicateNode,
  findParent,
  insertNode,
  moveNodeDown,
  moveNodeToParent,
  moveNodeUp,
  removeNode,
  reorderNode,
  replaceNode,
} from "./operations.ts";

const text = (id: string): EngineNode => ({
  id,
  name: id,
  type: "text",
  content: id,
  variant: "body",
});

const tree = (): EngineNode[] => [
  {
    id: "frame",
    name: "Frame",
    type: "frame",
    layout: { mode: "flex", gap: 12, padding: 12 },
    children: [text("a"), {
      id: "nested",
      name: "Nested",
      type: "frame",
      layout: { mode: "grid", gap: 8, padding: 8 },
      children: [text("b"), text("b-copy")],
    }],
  },
  text("c"),
];

describe("engine-v2 tree operations", () => {
  it("finds a node and its immediate parent", () => {
    const nodes = tree();
    const location = findParent(nodes, "b");
    assert.equal(location?.parentId, "nested");
    assert.equal(location?.index, 0);
    assert.equal(location?.node.id, "b");
    assert.equal(findParent(nodes, "frame")?.parent, null);
  });

  it("inserts at the root or inside a frame without mutating the input", () => {
    const nodes = tree();
    const nestedBefore = findParent(nodes, "nested")!.node;
    const rootInsert = insertNode(nodes, text("root-new"), null, 1);
    const childInsert = insertNode(nodes, text("child-new"), "nested", 1);
    assert.deepEqual(rootInsert.map((node) => node.id), ["frame", "root-new", "c"]);
    assert.deepEqual((findParent(childInsert, "nested")!.node as Extract<EngineNode, { type: "frame" }>).children.map((node) => node.id), ["b", "child-new", "b-copy"]);
    assert.equal(findParent(nodes, "nested")!.node, nestedBefore);
    assert.equal(findParent(nodes, "child-new"), null);
  });

  it("removes nested nodes while retaining untouched branches", () => {
    const nodes = tree();
    const untouched = nodes[1];
    const result = removeNode(nodes, "b");
    assert.equal(findParent(result, "b"), null);
    assert.equal(result[1], untouched);
    assert.ok(findParent(nodes, "b"));
    assert.equal(removeNode(nodes, "missing"), nodes);
  });

  it("replaces a node at the same location", () => {
    const nodes = tree();
    const replacement = { ...text("replacement"), content: "New text" } as EngineNode;
    const result = replaceNode(nodes, "a", replacement);
    assert.equal(findParent(result, "replacement")?.index, 0);
    assert.equal(findParent(result, "a"), null);
    assert.equal(replaceNode(nodes, "missing", replacement), nodes);
  });

  it("reorders and moves nodes only among their siblings", () => {
    const nodes = tree();
    const reordered = reorderNode(nodes, "b", 1);
    const movedUp = moveNodeUp(reordered, "b");
    const movedDown = moveNodeDown(movedUp, "b");
    const childIds = (value: EngineNode[]) => (findParent(value, "nested")!.node as Extract<EngineNode, { type: "frame" }>).children.map((node) => node.id);
    assert.deepEqual(childIds(reordered), ["b-copy", "b"]);
    assert.deepEqual(childIds(movedUp), ["b", "b-copy"]);
    assert.deepEqual(childIds(movedDown), ["b-copy", "b"]);
    assert.equal(moveNodeUp(nodes, "a"), nodes);
  });

  it("duplicates complete subtrees with stable collision-free ids", () => {
    const nodes = tree();
    const first = duplicateNode(nodes, "nested");
    const second = duplicateNode(first.nodes, "nested");
    assert.equal(first.duplicatedId, "nested-copy");
    assert.equal(second.duplicatedId, "nested-copy-2");
    const firstCopy = findParent(first.nodes, first.duplicatedId)!.node as Extract<EngineNode, { type: "frame" }>;
    assert.equal(firstCopy.name, "Nested copy");
    assert.deepEqual(firstCopy.children.map((node) => node.id), ["b-copy-2", "b-copy-copy"]);
    const allIds: string[] = [];
    const visit = (items: EngineNode[]) => items.forEach((node) => {
      allIds.push(node.id);
      if (node.type === "frame") visit(node.children);
    });
    visit(second.nodes);
    assert.equal(new Set(allIds).size, allIds.length);
    assert.equal(findParent(nodes, "nested-copy"), null);
  });

  it("moves nodes across parents at an exact insertion boundary", () => {
    const nodes = tree();
    const movedToRoot = moveNodeToParent(nodes, "b", null, 1);
    assert.deepEqual(movedToRoot.map((node) => node.id), ["frame", "b", "c"]);
    assert.equal(findParent(movedToRoot, "b")?.parentId, null);
    assert.deepEqual((findParent(movedToRoot, "nested")!.node as Extract<EngineNode, { type: "frame" }>).children.map((node) => node.id), ["b-copy"]);

    const movedIntoFrame = moveNodeToParent(nodes, "c", "nested", 1);
    assert.deepEqual((findParent(movedIntoFrame, "nested")!.node as Extract<EngineNode, { type: "frame" }>).children.map((node) => node.id), ["b", "c", "b-copy"]);
    assert.equal(findParent(movedIntoFrame, "c")?.parentId, "nested");
    assert.ok(findParent(nodes, "c")?.parentId === null);
  });

  it("normalizes same-parent insertion boundaries after removal", () => {
    const nodes = [text("a"), text("b"), text("c")];
    assert.deepEqual(moveNodeToParent(nodes, "a", null, 2).map((node) => node.id), ["b", "a", "c"]);
    assert.deepEqual(moveNodeToParent(nodes, "c", null, 1).map((node) => node.id), ["a", "c", "b"]);
    assert.equal(moveNodeToParent(nodes, "b", null, 2), nodes);
  });

  it("rejects cyclic and invalid cross-parent moves", () => {
    const nodes = tree();
    assert.equal(moveNodeToParent(nodes, "frame", "nested", 0), nodes);
    assert.equal(moveNodeToParent(nodes, "frame", "frame", 0), nodes);
    assert.equal(moveNodeToParent(nodes, "a", "c", 0), nodes);
    assert.equal(moveNodeToParent(nodes, "missing", null, 0), nodes);
  });
});
