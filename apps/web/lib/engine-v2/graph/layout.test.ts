import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { layoutGraph } from "./layout.ts";
import type { GraphDocument } from "./types.ts";

const FLOW: GraphDocument = {
  name: "Checkout flow",
  direction: "TB",
  nodes: [
    { id: "start", label: "Cart", kind: "process" },
    { id: "check", label: "Payment valid?", kind: "decision" },
    { id: "success", label: "Create order", kind: "process" },
    { id: "retry", label: "Try again", kind: "process" },
  ],
  edges: [
    { id: "e1", source: "start", target: "check" },
    { id: "e2", source: "check", target: "success", label: "Yes" },
    { id: "e3", source: "check", target: "retry", label: "No" },
    { id: "e4", source: "retry", target: "check" },
  ],
};

describe("layoutGraph", () => {
  it("produces stable layered positions and orthogonal edge routes", () => {
    const first = layoutGraph(FLOW);
    const second = layoutGraph(FLOW);
    assert.deepEqual(first, second);
    assert.ok(first.nodes.find((node) => node.id === "start")!.y < first.nodes.find((node) => node.id === "success")!.y);
    for (const edge of first.edges) {
      for (let index = 1; index < edge.points.length; index += 1) {
        const previous = edge.points[index - 1];
        const current = edge.points[index];
        assert.ok(previous.x === current.x || previous.y === current.y, `${edge.id} must be orthogonal`);
      }
    }
  });

  it("sizes ERD entities from their fields", () => {
    const result = layoutGraph({
      name: "ERD",
      nodes: [{ id: "users", label: "Users", kind: "entity", fields: [
        { name: "id", key: "primary" },
        { name: "workspace_id", key: "foreign" },
        { name: "email", type: "text" },
      ] }],
      edges: [],
    });
    assert.equal(result.nodes[0].height, 132);
  });

  it("supports cycles without invalid geometry", () => {
    const result = layoutGraph(FLOW, { direction: "LR" });
    for (const node of result.nodes) {
      assert.ok(Number.isFinite(node.x));
      assert.ok(Number.isFinite(node.y));
    }
    for (const edge of result.edges) {
      assert.ok(edge.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
    }
  });

  it("drops invalid references with a warning", () => {
    const result = layoutGraph({
      name: "Invalid",
      nodes: [{ id: "known", label: "Known", kind: "system" }],
      edges: [{ id: "broken", source: "known", target: "missing" }],
    });
    assert.equal(result.edges.length, 0);
    assert.deepEqual(result.warnings, ["Skipped edge broken: endpoint not found"]);
  });

  it("preserves org and architecture semantics for rendering", () => {
    const result = layoutGraph({
      name: "Platform ownership",
      direction: "LR",
      nodes: [
        { id: "lead", label: "Product lead", kind: "person", group: "Product" },
        { id: "api", label: "Generation API", kind: "service", group: "Runtime" },
        { id: "db", label: "Projects", kind: "database", group: "Runtime" },
      ],
      edges: [
        { id: "owns", source: "lead", target: "api", kind: "reports-to", label: "owns" },
        { id: "writes", source: "api", target: "db", kind: "data" },
      ],
    });
    assert.equal(result.nodes.find((node) => node.id === "lead")?.kind, "person");
    assert.equal(result.nodes.find((node) => node.id === "api")?.group, "Runtime");
    assert.equal(result.edges.find((edge) => edge.id === "writes")?.kind, "data");
    assert.ok(result.nodes.find((node) => node.id === "lead")!.x < result.nodes.find((node) => node.id === "db")!.x);
  });
});
