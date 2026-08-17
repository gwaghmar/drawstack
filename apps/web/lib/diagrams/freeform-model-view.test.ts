import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serializeForModel, describeCanvas, MODEL_VIEW_GUIDE } from "./freeform-model-view.ts";
import type { CanvasDocument, RectShape, ArrowShape, EllipseShape, TextShape } from "./freeform-canvas.ts";

describe("serializeForModel", () => {
  it("emits header line with shape count and one line per shape", () => {
    const rect: RectShape = { id: "s1", type: "rectangle", x: 10, y: 20, width: 100, height: 50 };
    const ellipse: EllipseShape = { id: "s2", type: "ellipse", x: 200, y: 30, width: 80, height: 80 };
    const doc: CanvasDocument = { version: 1, shapes: [rect, ellipse] };

    const result = serializeForModel(doc);
    const lines = result.split("\n");

    assert.equal(lines.length, 3);
    assert.equal(lines[0], "canvas v1 | 2 shapes | coordinates: canvas-absolute px, y grows downward");
  });

  it("uses fixed key order for a fully-populated rectangle", () => {
    const rect: RectShape = {
      id: "r1",
      name: "box",
      role: "container",
      type: "rectangle",
      x: 10.4,
      y: 20.6,
      width: 100,
      height: 50,
      rotation: 15,
      fill: "1",
      stroke: "#000000",
      strokeWidth: 2,
      opacity: 0.5,
      cornerRadius: 8,
      frameId: "f1",
      locked: true,
      text: { content: "Hello", fontSize: 14.6, fontFamily: "Inter", align: "center", color: "#fff", bold: true },
    };
    const doc: CanvasDocument = { version: 1, shapes: [rect] };

    const line = serializeForModel(doc).split("\n")[1];
    const expected = JSON.stringify({
      id: "r1",
      name: "box",
      role: "container",
      type: "rectangle",
      x: 10,
      y: 21,
      width: 100,
      height: 50,
      rotation: 15,
      fill: "1",
      stroke: "#000000",
      strokeWidth: 2,
      opacity: 0.5,
      cornerRadius: 8,
      frameId: "f1",
      locked: true,
      text: { content: "Hello", fontSize: 15, fontFamily: "Inter", align: "center", color: "#fff", bold: true },
    });

    assert.equal(line, expected);
  });

  it("omits frameId:null, rotation:0, opacity:1, and absent keys", () => {
    const rect: RectShape = {
      id: "r1",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      rotation: 0,
      opacity: 1,
      frameId: null,
    };
    const doc: CanvasDocument = { version: 1, shapes: [rect] };

    const line = serializeForModel(doc).split("\n")[1];
    const parsed = JSON.parse(line);

    assert.equal("frameId" in parsed, false);
    assert.equal("rotation" in parsed, false);
    assert.equal("opacity" in parsed, false);
    assert.equal("name" in parsed, false);
    assert.equal("role" in parsed, false);
    assert.equal("fill" in parsed, false);
    assert.equal("text" in parsed, false);
    assert.deepEqual(parsed, { id: "r1", type: "rectangle", x: 0, y: 0, width: 10, height: 10 });
  });

  it("rounds float coordinates and fontSize to integers", () => {
    const text: TextShape = {
      id: "t1",
      type: "text",
      x: 1.2,
      y: 2.7,
      width: 30.5,
      height: 10.1,
      text: { content: "hi", fontSize: 12.9 },
    };
    const doc: CanvasDocument = { version: 1, shapes: [text] };

    const parsed = JSON.parse(serializeForModel(doc).split("\n")[1]);
    assert.equal(parsed.x, 1);
    assert.equal(parsed.y, 3);
    assert.equal(parsed.width, 31);
    assert.equal(parsed.height, 10);
    assert.equal(parsed.text.fontSize, 13);
  });

  it("serializes a bound arrow endpoint without anchor when auto, and keeps explicit anchor", () => {
    const rectA: RectShape = { id: "a", type: "rectangle", x: 0, y: 0, width: 10, height: 10 };
    const rectB: RectShape = { id: "b", type: "rectangle", x: 100, y: 100, width: 10, height: 10 };
    const arrow: ArrowShape = {
      id: "arr1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "a", anchor: "auto" },
      end: { shapeId: "b", anchor: "left" },
    };
    const doc: CanvasDocument = { version: 1, shapes: [rectA, rectB, arrow] };

    const parsed = JSON.parse(serializeForModel(doc).split("\n")[3]);
    assert.deepEqual(parsed.start, { shapeId: "a" });
    assert.deepEqual(parsed.end, { shapeId: "b", anchor: "left" });
  });

  it("serializes a free arrow endpoint as rounded x/y", () => {
    const arrow: ArrowShape = {
      id: "arr1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { x: 1.6, y: 2.4 },
      end: { x: 50.2, y: 60.9 },
    };
    const doc: CanvasDocument = { version: 1, shapes: [arrow] };

    const parsed = JSON.parse(serializeForModel(doc).split("\n")[1]);
    assert.deepEqual(parsed.start, { x: 2, y: 2 });
    assert.deepEqual(parsed.end, { x: 50, y: 61 });
  });

  it("passes palette keys through unresolved", () => {
    const rect: RectShape = { id: "r1", type: "rectangle", x: 0, y: 0, width: 10, height: 10, fill: "3", stroke: "5" };
    const doc: CanvasDocument = { version: 1, shapes: [rect] };

    const parsed = JSON.parse(serializeForModel(doc).split("\n")[1]);
    assert.equal(parsed.fill, "3");
    assert.equal(parsed.stroke, "5");
  });

  it("every shape line independently JSON.parses in a mixed fixture", () => {
    const rect: RectShape = { id: "r1", name: "box", type: "rectangle", x: 0, y: 0, width: 10, height: 10 };
    const ellipse: EllipseShape = { id: "e1", type: "ellipse", x: 20, y: 20, width: 10, height: 10 };
    const text: TextShape = { id: "t1", type: "text", x: 0, y: 30, width: 40, height: 20, text: { content: "note" } };
    const arrow: ArrowShape = {
      id: "arr1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "r1" },
      end: { x: 100, y: 100 },
      label: "flows to",
    };
    const doc: CanvasDocument = { version: 1, shapes: [rect, ellipse, text, arrow] };

    const lines = serializeForModel(doc).split("\n").slice(1);
    assert.equal(lines.length, 4);
    for (const line of lines) {
      assert.doesNotThrow(() => JSON.parse(line));
    }
    const arrowParsed = JSON.parse(lines[3]);
    assert.equal(arrowParsed.label, "flows to");
  });

  it("is deterministic under an input key shuffle", () => {
    const rect: RectShape = {
      id: "r1",
      name: "box",
      type: "rectangle",
      x: 5,
      y: 5,
      width: 10,
      height: 10,
      fill: "2",
      stroke: "#111",
      text: { content: "hi", fontSize: 12 },
    };
    const doc: CanvasDocument = { version: 1, shapes: [rect] };
    const original = serializeForModel(doc);

    const shuffled = JSON.parse(JSON.stringify(doc));
    const shuffledShape: Record<string, unknown> = {};
    const keys = Object.keys(shuffled.shapes[0]).reverse();
    for (const key of keys) shuffledShape[key] = shuffled.shapes[0][key];
    shuffled.shapes[0] = shuffledShape;

    const result = serializeForModel(shuffled as CanvasDocument);
    assert.equal(result, original);
  });
});

describe("describeCanvas", () => {
  it("returns 'Empty canvas.' for an empty document", () => {
    assert.equal(describeCanvas({ version: 1, shapes: [] }), "Empty canvas.");
  });

  it("summarizes counts by type and bounding box", () => {
    const rectA: RectShape = { id: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 50 };
    const rectB: RectShape = { id: "b", type: "rectangle", x: 200, y: 100, width: 50, height: 50 };
    const doc: CanvasDocument = { version: 1, shapes: [rectA, rectB] };

    const description = describeCanvas(doc);
    assert.match(description, /2 rectangles/);
    assert.match(description, /\(0, 0\) to \(250, 150\)/);
  });

  it("prefers named shapes in the notable list", () => {
    const named: RectShape = { id: "a", name: "Login Box", type: "rectangle", x: 0, y: 0, width: 10, height: 10 };
    const unnamed: RectShape = { id: "b", type: "rectangle", x: 20, y: 20, width: 10, height: 10 };
    const doc: CanvasDocument = { version: 1, shapes: [named, unnamed] };

    const description = describeCanvas(doc);
    assert.match(description, /Login Box \(rectangle\)/);
    assert.doesNotMatch(description, /"" \(rectangle\)/);
  });

  it("falls back to truncated text content when fewer than 10 named shapes exist", () => {
    const withText: TextShape = {
      id: "t1",
      type: "text",
      x: 0,
      y: 0,
      width: 40,
      height: 20,
      text: { content: "This is a very long note that exceeds thirty characters" },
    };
    const doc: CanvasDocument = { version: 1, shapes: [withText] };

    const description = describeCanvas(doc);
    const truncated = "This is a very long note that exceeds thirty characters".slice(0, 30);
    assert.ok(description.includes(`"${truncated}..." (text)`));
  });
});

describe("MODEL_VIEW_GUIDE", () => {
  it("is a non-empty plain-text constant mentioning key conventions", () => {
    assert.equal(typeof MODEL_VIEW_GUIDE, "string");
    assert.match(MODEL_VIEW_GUIDE, /canvas-absolute/);
    assert.match(MODEL_VIEW_GUIDE, /add\/update\/delete\/connect\/place\/layout\/reorder/);
    assert.doesNotMatch(MODEL_VIEW_GUIDE, /^#/m);
  });
});
