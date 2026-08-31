import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EngineNode } from "./document.ts";
import {
  alignNodes,
  copyNodes,
  duplicateNode,
  duplicateNodes,
  distributeNodes,
  findParent,
  insertNode,
  moveNodeDown,
  moveNodeByArrow,
  moveNodeToParent,
  moveNodeUp,
  pasteNodes,
  removeNode,
  removeNodes,
  reorderNode,
  replaceNode,
  uniqueNodeId,
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

  it("does not mutate locked nodes or locked frame contents", () => {
    const nodes = tree();
    const lockedNodes = replaceNode(nodes, "b", { ...text("b"), locked: true });
    assert.equal(removeNode(lockedNodes, "b"), lockedNodes);
    assert.equal(reorderNode(lockedNodes, "b", 1), lockedNodes);
    assert.equal(duplicateNode(lockedNodes, "b").nodes, lockedNodes);

    const lockedFrame = replaceNode(nodes, "nested", {
      ...(findParent(nodes, "nested")!.node as Extract<EngineNode, { type: "frame" }>),
      locked: true,
    });
    assert.equal(moveNodeToParent(lockedFrame, "c", "nested"), lockedFrame);
    assert.deepEqual(pasteNodes(lockedFrame, [text("pasted")], "nested").pastedIds, []);
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

  it("supports accessible arrow reorder, indent, and outdent", () => {
    const nodes = tree();
    const movedDown = moveNodeByArrow(nodes, "b", "down");
    assert.deepEqual((findParent(movedDown, "nested")!.node as Extract<EngineNode, { type: "frame" }>).children.map((node) => node.id), ["b-copy", "b"]);

    assert.equal(moveNodeByArrow(nodes, "nested", "right"), nodes);
    const indentCandidate: EngineNode[] = [{
      id: "outer",
      name: "Outer",
      type: "frame",
      layout: { mode: "flex", gap: 0, padding: 0 },
      children: [],
    }, text("loose")];
    const nestedIntoPrevious = moveNodeByArrow(indentCandidate, "loose", "right");
    assert.equal(findParent(nestedIntoPrevious, "loose")?.parentId, "outer");

    const outdented = moveNodeByArrow(nodes, "b", "left");
    assert.equal(findParent(outdented, "b")?.parentId, "frame");
    assert.deepEqual((findParent(outdented, "frame")!.node as Extract<EngineNode, { type: "frame" }>).children.map((node) => node.id), ["a", "nested", "b"]);
    assert.equal(moveNodeByArrow(nodes, "frame", "left"), nodes);
  });

  it("duplicates and removes multi-selections without duplicating descendants twice", () => {
    const nodes = tree();
    const duplicate = duplicateNodes(nodes, ["nested", "b", "c"]);
    assert.deepEqual(duplicate.duplicatedIds, ["nested-copy", "c-copy"]);
    assert.ok(findParent(duplicate.nodes, "nested-copy"));
    assert.ok(findParent(duplicate.nodes, "c-copy"));

    const removed = removeNodes(nodes, ["nested", "b", "c"]);
    assert.equal(findParent(removed, "nested"), null);
    assert.equal(findParent(removed, "c"), null);
    assert.deepEqual((findParent(removed, "frame")!.node as Extract<EngineNode, { type: "frame" }>).children.map((node) => node.id), ["a"]);
    assert.equal(removeNodes(nodes, ["frame", "c"]), nodes);
  });

  it("aligns and distributes only sibling selections through layout properties", () => {
    const nodes = tree();
    const aligned = alignNodes(nodes, ["b", "b-copy"], "center");
    assert.equal(findParent(aligned, "b")!.node.style?.alignSelf, "center");
    assert.equal(findParent(aligned, "b-copy")!.node.style?.alignSelf, "center");
    assert.equal(alignNodes(nodes, ["a", "b"], "end"), nodes);

    const distributed = distributeNodes(nodes, ["b", "b-copy"], "evenly");
    const nested = findParent(distributed, "nested")!.node as Extract<EngineNode, { type: "frame" }>;
    assert.equal(nested.layout.justify, "space-evenly");
    assert.equal(distributeNodes(nodes, ["a", "c"], "between"), nodes);
  });

  it("copies and pastes isolated subtrees with fresh ids", () => {
    const nodes = tree();
    const clipboard = copyNodes(nodes, ["nested", "b"]);
    assert.equal(clipboard.length, 1);
    const source = findParent(nodes, "nested")!.node as Extract<EngineNode, { type: "frame" }>;
    assert.notEqual(clipboard[0], source);
    assert.notEqual((clipboard[0] as Extract<EngineNode, { type: "frame" }>).children, source.children);

    const pasted = pasteNodes(nodes, clipboard, "frame", 1);
    assert.deepEqual(pasted.pastedIds, ["nested-copy"]);
    const pastedFrame = findParent(pasted.nodes, "nested-copy")!.node as Extract<EngineNode, { type: "frame" }>;
    assert.deepEqual(pastedFrame.children.map((node) => node.id), ["b-copy-2", "b-copy-copy"]);
    assert.notEqual(pastedFrame.children[0], source.children[0]);
    assert.equal(findParent(nodes, "nested-copy"), null);
    assert.equal(pasteNodes(nodes, clipboard, "c", 0).nodes, nodes);
  });

  it("generates stable unique ids for inserted nodes", () => {
    const nodes = [...tree(), text("text"), text("text-2")];
    assert.equal(uniqueNodeId(nodes, "chart"), "chart");
    assert.equal(uniqueNodeId(nodes, "text"), "text-3");
  });
});
