import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createEmptyDocument,
  parseFreeformSource,
  serializeFreeformDocument,
  resolveArrowEndpoint,
  validateFreeformRefs,
  getShapeBounds,
  resolveColor,
  type CanvasDocument,
  type RectShape,
  type FrameShape,
  type ArrowShape,
  type EllipseShape,
} from "./freeform-canvas.ts";

describe("parseFreeformSource and serializeFreeformDocument", () => {
  it("round-trip: serialize and parse a complex document with frame and bound arrow", () => {
    const rect: RectShape = {
      id: "s1",
      type: "rectangle",
      x: 50,
      y: 50,
      width: 160,
      height: 90,
      fill: "#e0e7ff",
      stroke: "#4f46e5",
    };
    const ellipse: EllipseShape = {
      id: "s2",
      type: "ellipse",
      x: 280,
      y: 60,
      width: 120,
      height: 120,
      fill: "#fef3c7",
      stroke: "#d97706",
    };
    const frame: FrameShape = {
      id: "frame1",
      type: "frame",
      x: 0,
      y: 0,
      width: 500,
      height: 300,
      name: "Main frame",
    };
    const arrow: ArrowShape = {
      id: "arrow1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "s1", anchor: "right" },
      end: { shapeId: "s2", anchor: "left" },
    };

    const doc: CanvasDocument = {
      version: 1,
      shapes: [rect, ellipse, frame, arrow],
    };

    const serialized = serializeFreeformDocument(doc);
    const { doc: parsed, errors } = parseFreeformSource(serialized);

    assert.deepEqual(errors, []);
    assert.deepEqual(parsed, doc);
  });
});

describe("parseFreeformSource error handling", () => {
  it("returns empty document and an error for invalid JSON", () => {
    const { doc, errors } = parseFreeformSource("not json");
    assert.deepEqual(doc, createEmptyDocument());
    assert.equal(errors.length, 1);
    assert(errors[0].includes("Invalid JSON"));
  });

  it("returns empty document and an error for JSON without version/shapes", () => {
    const { doc, errors } = parseFreeformSource("{}");
    assert.deepEqual(doc, createEmptyDocument());
    assert.equal(errors.length, 1);
    assert(errors[0].includes("version") && errors[0].includes("shapes"));
  });

  it("returns empty document and an error for JSON with shapes that is not an array", () => {
    const { doc, errors } = parseFreeformSource(JSON.stringify({ version: 1, shapes: "not an array" }));
    assert.deepEqual(doc, createEmptyDocument());
    assert.equal(errors.length, 1);
    assert(errors[0].includes("array"));
  });

  it("returns empty document and an error for JSON with missing shapes field", () => {
    const { doc, errors } = parseFreeformSource(JSON.stringify({ version: 1 }));
    assert.deepEqual(doc, createEmptyDocument());
    assert.equal(errors.length, 1);
  });

  it("treats empty string as a blank canvas, not an error", () => {
    const { doc, errors } = parseFreeformSource("");
    assert.deepEqual(doc, createEmptyDocument());
    assert.equal(errors.length, 0);
  });
});

describe("resolveArrowEndpoint", () => {
  it("resolves free endpoints unchanged", () => {
    const doc = createEmptyDocument();
    const result = resolveArrowEndpoint(doc, { x: 100, y: 200 });
    assert.deepEqual(result, { x: 100, y: 200 });
  });

  it("resolves bound endpoint with anchor top", () => {
    const rect: RectShape = { id: "s1", type: "rectangle", x: 50, y: 50, width: 160, height: 90 };
    const doc: CanvasDocument = { version: 1, shapes: [rect] };
    const result = resolveArrowEndpoint(doc, { shapeId: "s1", anchor: "top" });
    assert.deepEqual(result, { x: 50 + 80, y: 50 }); // center-x, top-y
  });

  it("resolves bound endpoint with anchor bottom", () => {
    const rect: RectShape = { id: "s1", type: "rectangle", x: 50, y: 50, width: 160, height: 90 };
    const doc: CanvasDocument = { version: 1, shapes: [rect] };
    const result = resolveArrowEndpoint(doc, { shapeId: "s1", anchor: "bottom" });
    assert.deepEqual(result, { x: 50 + 80, y: 50 + 90 }); // center-x, bottom-y
  });

  it("resolves bound endpoint with anchor left", () => {
    const rect: RectShape = { id: "s1", type: "rectangle", x: 50, y: 50, width: 160, height: 90 };
    const doc: CanvasDocument = { version: 1, shapes: [rect] };
    const result = resolveArrowEndpoint(doc, { shapeId: "s1", anchor: "left" });
    assert.deepEqual(result, { x: 50, y: 50 + 45 }); // left-x, center-y
  });

  it("resolves bound endpoint with anchor right", () => {
    const rect: RectShape = { id: "s1", type: "rectangle", x: 50, y: 50, width: 160, height: 90 };
    const doc: CanvasDocument = { version: 1, shapes: [rect] };
    const result = resolveArrowEndpoint(doc, { shapeId: "s1", anchor: "right" });
    assert.deepEqual(result, { x: 50 + 160, y: 50 + 45 }); // right-x, center-y
  });

  it("resolves bound endpoint with anchor center", () => {
    const rect: RectShape = { id: "s1", type: "rectangle", x: 50, y: 50, width: 160, height: 90 };
    const doc: CanvasDocument = { version: 1, shapes: [rect] };
    const result = resolveArrowEndpoint(doc, { shapeId: "s1", anchor: "center" });
    assert.deepEqual(result, { x: 50 + 80, y: 50 + 45 }); // center
  });

  it("resolves bound endpoint with anchor auto (defaults to center)", () => {
    const rect: RectShape = { id: "s1", type: "rectangle", x: 50, y: 50, width: 160, height: 90 };
    const doc: CanvasDocument = { version: 1, shapes: [rect] };
    const result = resolveArrowEndpoint(doc, { shapeId: "s1", anchor: "auto" });
    assert.deepEqual(result, { x: 50 + 80, y: 50 + 45 }); // center
  });

  it("resolves bound endpoint with no anchor specified (defaults to center)", () => {
    const rect: RectShape = { id: "s1", type: "rectangle", x: 50, y: 50, width: 160, height: 90 };
    const doc: CanvasDocument = { version: 1, shapes: [rect] };
    const result = resolveArrowEndpoint(doc, { shapeId: "s1" });
    assert.deepEqual(result, { x: 50 + 80, y: 50 + 45 }); // center
  });

  it("returns safe fallback with an error for missing shape id", () => {
    const doc = createEmptyDocument();
    const result = resolveArrowEndpoint(doc, { shapeId: "missing", anchor: "top" });
    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
    assert.equal(result.error, 'Arrow endpoint references missing shape "missing"');
  });

  it("does not throw for missing shape id", () => {
    const doc = createEmptyDocument();
    assert.doesNotThrow(() => {
      resolveArrowEndpoint(doc, { shapeId: "missing" });
    });
  });
});

describe("validateFreeformRefs", () => {
  it("returns empty array for valid document", () => {
    const rect: RectShape = { id: "s1", type: "rectangle", x: 50, y: 50, width: 160, height: 90 };
    const frame: FrameShape = { id: "frame1", type: "frame", x: 0, y: 0, width: 500, height: 300 };
    const arrow: ArrowShape = {
      id: "arrow1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "s1", anchor: "right" },
      end: { shapeId: "frame1", anchor: "left" },
    };
    const rectInFrame: RectShape = {
      id: "s2",
      type: "rectangle",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      frameId: "frame1",
    };
    const doc: CanvasDocument = { version: 1, shapes: [rect, frame, arrow, rectInFrame] };
    const errors = validateFreeformRefs(doc);
    assert.equal(errors.length, 0);
  });

  it("detects duplicate shape IDs", () => {
    const rect1: RectShape = { id: "s1", type: "rectangle", x: 50, y: 50, width: 160, height: 90 };
    const rect2: RectShape = { id: "s1", type: "rectangle", x: 150, y: 150, width: 160, height: 90 };
    const doc: CanvasDocument = { version: 1, shapes: [rect1, rect2] };
    const errors = validateFreeformRefs(doc);
    assert(errors.length > 0);
    assert(errors[0].includes("Duplicate shape id"));
  });

  it("detects dangling frameId reference", () => {
    const rect: RectShape = {
      id: "s1",
      type: "rectangle",
      x: 50,
      y: 50,
      width: 160,
      height: 90,
      frameId: "missing_frame",
    };
    const doc: CanvasDocument = { version: 1, shapes: [rect] };
    const errors = validateFreeformRefs(doc);
    assert(errors.length > 0);
    assert(errors[0].includes("frameId") && errors[0].includes("not a frame"));
  });

  it("detects dangling frameId when referenced shape is not a frame", () => {
    const rect1: RectShape = { id: "s1", type: "rectangle", x: 50, y: 50, width: 160, height: 90 };
    const rect2: RectShape = {
      id: "s2",
      type: "rectangle",
      x: 150,
      y: 150,
      width: 160,
      height: 90,
      frameId: "s1",
    };
    const doc: CanvasDocument = { version: 1, shapes: [rect1, rect2] };
    const errors = validateFreeformRefs(doc);
    assert(errors.length > 0);
    assert(errors[0].includes("not a frame"));
  });

  it("detects dangling arrow start reference", () => {
    const arrow: ArrowShape = {
      id: "arrow1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "missing", anchor: "right" },
      end: { x: 200, y: 200 },
    };
    const doc: CanvasDocument = { version: 1, shapes: [arrow] };
    const errors = validateFreeformRefs(doc);
    assert(errors.length > 0);
    assert(errors[0].includes("start references missing"));
  });

  it("detects dangling arrow end reference", () => {
    const rect: RectShape = { id: "s1", type: "rectangle", x: 50, y: 50, width: 160, height: 90 };
    const arrow: ArrowShape = {
      id: "arrow1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "s1", anchor: "right" },
      end: { shapeId: "missing", anchor: "left" },
    };
    const doc: CanvasDocument = { version: 1, shapes: [rect, arrow] };
    const errors = validateFreeformRefs(doc);
    assert(errors.length > 0);
    assert(errors[0].includes("end references missing"));
  });

  it("handles null frameId gracefully", () => {
    const rect: RectShape = {
      id: "s1",
      type: "rectangle",
      x: 50,
      y: 50,
      width: 160,
      height: 90,
      frameId: null,
    };
    const doc: CanvasDocument = { version: 1, shapes: [rect] };
    const errors = validateFreeformRefs(doc);
    assert.equal(errors.length, 0);
  });

  it("detects duplicate shape names", () => {
    const rect1: RectShape = { id: "s1", name: "database", type: "rectangle", x: 50, y: 50, width: 160, height: 90 };
    const rect2: RectShape = { id: "s2", name: "database", type: "rectangle", x: 150, y: 150, width: 160, height: 90 };
    const doc: CanvasDocument = { version: 1, shapes: [rect1, rect2] };
    const errors = validateFreeformRefs(doc);
    assert(errors.some((e) => e.includes("Duplicate shape name")));
  });

  it("allows multiple shapes with no name", () => {
    const rect1: RectShape = { id: "s1", type: "rectangle", x: 50, y: 50, width: 160, height: 90 };
    const rect2: RectShape = { id: "s2", type: "rectangle", x: 150, y: 150, width: 160, height: 90 };
    const doc: CanvasDocument = { version: 1, shapes: [rect1, rect2] };
    const errors = validateFreeformRefs(doc);
    assert.equal(errors.length, 0);
  });

  it("allows one named shape alongside unnamed shapes", () => {
    const rect1: RectShape = { id: "s1", name: "database", type: "rectangle", x: 50, y: 50, width: 160, height: 90 };
    const rect2: RectShape = { id: "s2", type: "rectangle", x: 150, y: 150, width: 160, height: 90 };
    const doc: CanvasDocument = { version: 1, shapes: [rect1, rect2] };
    const errors = validateFreeformRefs(doc);
    assert.equal(errors.length, 0);
  });
});

describe("getShapeBounds", () => {
  it("returns x/y/width/height for a rectangle", () => {
    const rect: RectShape = { id: "s1", type: "rectangle", x: 50, y: 50, width: 160, height: 90 };
    const doc: CanvasDocument = { version: 1, shapes: [rect] };
    assert.deepEqual(getShapeBounds(doc, rect), { x: 50, y: 50, width: 160, height: 90 });
  });

  it("computes bounds for an arrow with free (unbound) endpoints", () => {
    const arrow: ArrowShape = {
      id: "arrow1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { x: 10, y: 100 },
      end: { x: 200, y: 20 },
    };
    const doc: CanvasDocument = { version: 1, shapes: [arrow] };
    assert.deepEqual(getShapeBounds(doc, arrow), { x: 10, y: 20, width: 190, height: 80 });
  });

  it("computes bounds for an arrow bound to shapes", () => {
    const rect1: RectShape = { id: "s1", type: "rectangle", x: 0, y: 0, width: 100, height: 100 };
    const rect2: RectShape = { id: "s2", type: "rectangle", x: 300, y: 300, width: 100, height: 100 };
    const arrow: ArrowShape = {
      id: "arrow1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "s1", anchor: "center" },
      end: { shapeId: "s2", anchor: "center" },
    };
    const doc: CanvasDocument = { version: 1, shapes: [rect1, rect2, arrow] };
    assert.deepEqual(getShapeBounds(doc, arrow), { x: 50, y: 50, width: 300, height: 300 });
  });
});

describe("resolveColor", () => {
  it("resolves a palette key to its light hex by default", () => {
    assert.equal(resolveColor("1"), "#e03131");
  });

  it("resolves a palette key to its dark hex when theme is dark", () => {
    assert.equal(resolveColor("1", "dark"), "#ff8787");
  });

  it("passes through a non-palette color unchanged", () => {
    assert.equal(resolveColor("#4f46e5"), "#4f46e5");
    assert.equal(resolveColor("tomato"), "tomato");
  });

  it("returns undefined for undefined input", () => {
    assert.equal(resolveColor(undefined), undefined);
  });
});
