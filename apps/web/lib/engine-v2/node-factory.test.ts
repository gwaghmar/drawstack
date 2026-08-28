import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultNode, type InsertableNodeType } from "./node-factory.ts";

describe("createDefaultNode", () => {
  it("creates valid deterministic starter content for every insertable type", () => {
    const types: InsertableNodeType[] = ["text", "metric", "frame", "chart", "graph"];
    const first = types.map((type) => createDefaultNode(type, `new-${type}`));
    const second = types.map((type) => createDefaultNode(type, `new-${type}`));
    assert.deepEqual(first, second);
    assert.deepEqual(first.map((node) => node.type), types);
    const graph = first.find((node) => node.type === "graph")!;
    assert.equal(graph.graph.nodes.length, 3);
    assert.equal(graph.graph.edges.length, 2);
  });
});
