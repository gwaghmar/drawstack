import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyPatch, isValidJson, applyOpsToSource } from "./agent-tools.ts";
import { serializeFreeformDocument } from "./diagrams/freeform-canvas.ts";
import type { CanvasDocument } from "./diagrams/freeform-canvas.ts";

describe("isValidJson", () => {
  it("accepts well-formed JSON", () => {
    assert.equal(isValidJson('{"nodes":[]}'), true);
    assert.equal(isValidJson("[1,2,3]"), true);
  });
  it("rejects malformed JSON", () => {
    assert.equal(isValidJson('{"nodes":[}'), false);
    assert.equal(isValidJson("not json"), false);
  });
});

describe("applyPatch", () => {
  it("replaces a single occurrence and reports count", () => {
    const r = applyPatch("color: red", "red", "blue");
    assert.equal(r.source, "color: blue");
    assert.equal(r.replaced, 1);
  });

  it("replaces ALL occurrences (not just the first)", () => {
    const r = applyPatch("a x a x a", "a", "Z");
    assert.equal(r.source, "Z x Z x Z");
    assert.equal(r.replaced, 3);
  });

  it("returns replaced:0 and unchanged source when find is absent", () => {
    const r = applyPatch("hello world", "missing", "x");
    assert.equal(r.source, "hello world");
    assert.equal(r.replaced, 0);
  });

  it("treats empty find as a no-op", () => {
    const r = applyPatch("hello", "", "x");
    assert.equal(r.source, "hello");
    assert.equal(r.replaced, 0);
  });

  it("does not interpret regex metacharacters in find", () => {
    const r = applyPatch("price is $5 (USD)", "$5 (USD)", "$9 (EUR)");
    assert.equal(r.source, "price is $9 (EUR)");
    assert.equal(r.replaced, 1);
  });
});

describe("applyOpsToSource", () => {
  const baseDoc: CanvasDocument = {
    version: 1,
    shapes: [{ id: "s_a", name: "api", type: "rectangle", x: 100, y: 100, width: 160, height: 80 }],
  };

  it("applies ops and returns a re-serialized source plus a canvas view", () => {
    const source = serializeFreeformDocument(baseDoc);
    const result = applyOpsToSource(source, [{ op: "update", target: "api", set: { fill: "2" } }]);
    assert.equal(result.applied, 1);
    assert.equal(result.errors.length, 0);
    assert.ok(result.source);
    const reparsed = JSON.parse(result.source as string);
    assert.equal(reparsed.shapes[0].fill, "2");
    assert.match(result.canvas, /canvas v1 \| 1 shapes/);
  });

  it("returns source:null when every op fails", () => {
    const source = serializeFreeformDocument(baseDoc);
    const result = applyOpsToSource(source, [{ op: "update", target: "missing", set: { fill: "2" } }]);
    assert.equal(result.applied, 0);
    assert.equal(result.source, null);
    assert.equal(result.errors.length, 1);
  });

  it("parses an empty source as an empty document", () => {
    const result = applyOpsToSource("", [{ op: "add", shape: { id: "s1", type: "rectangle" } }]);
    assert.equal(result.applied, 1);
    assert.ok(result.source);
  });
});
