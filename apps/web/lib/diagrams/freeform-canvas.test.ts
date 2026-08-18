import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createEmptyDocument,
  parseFreeformSource,
  serializeFreeformDocument,
  resolveArrowEndpoint,
  resolveArrowRenderEndpoints,
  nearestEdgeAnchor,
  validateFreeformRefs,
  getShapeBounds,
  resolveColor,
  computeArrowHeadGeometry,
  fitTextFontSize,
  resolveArrowHeadStyle,
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

describe("nearestEdgeAnchor", () => {
  it("picks right when the target is directly to the right", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 50 };
    assert.equal(nearestEdgeAnchor(bounds, 300, 25), "right");
  });

  it("picks left when the target is directly to the left", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 50 };
    assert.equal(nearestEdgeAnchor(bounds, -200, 25), "left");
  });

  it("picks top when the target is above", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    assert.equal(nearestEdgeAnchor(bounds, 50, -200), "top");
  });

  it("picks bottom when the target is below", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    assert.equal(nearestEdgeAnchor(bounds, 50, 300), "bottom");
  });
});

describe("resolveArrowRenderEndpoints", () => {
  it("attaches auto-anchored endpoints to the nearest edge midpoint for horizontally arranged shapes", () => {
    const s1: RectShape = { id: "s1", type: "rectangle", x: 0, y: 0, width: 100, height: 100 };
    const s2: RectShape = { id: "s2", type: "rectangle", x: 300, y: 0, width: 100, height: 100 };
    const arrow: ArrowShape = {
      id: "arrow1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "s1", anchor: "auto" },
      end: { shapeId: "s2", anchor: "auto" },
    };
    const doc: CanvasDocument = { version: 1, shapes: [s1, s2, arrow] };
    const result = resolveArrowRenderEndpoints(doc, arrow);
    assert.deepEqual(result.start, { x: 100, y: 50 });
    assert.deepEqual(result.end, { x: 300, y: 50 });
  });

  it("attaches auto-anchored endpoints to the nearest edge midpoint for vertically arranged shapes", () => {
    const s1: RectShape = { id: "s1", type: "rectangle", x: 0, y: 0, width: 100, height: 100 };
    const s2: RectShape = { id: "s2", type: "rectangle", x: 0, y: 300, width: 100, height: 100 };
    const arrow: ArrowShape = {
      id: "arrow1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "s1" },
      end: { shapeId: "s2" },
    };
    const doc: CanvasDocument = { version: 1, shapes: [s1, s2, arrow] };
    const result = resolveArrowRenderEndpoints(doc, arrow);
    assert.deepEqual(result.start, { x: 50, y: 100 });
    assert.deepEqual(result.end, { x: 50, y: 300 });
  });

  it("keeps an explicit anchor unchanged even when auto would pick a different edge", () => {
    const s1: RectShape = { id: "s1", type: "rectangle", x: 0, y: 0, width: 100, height: 100 };
    const s2: RectShape = { id: "s2", type: "rectangle", x: 300, y: 0, width: 100, height: 100 };
    const arrow: ArrowShape = {
      id: "arrow1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "s1", anchor: "top" },
      end: { shapeId: "s2", anchor: "auto" },
    };
    const doc: CanvasDocument = { version: 1, shapes: [s1, s2, arrow] };
    const result = resolveArrowRenderEndpoints(doc, arrow);
    assert.deepEqual(result.start, { x: 50, y: 0 });
    assert.deepEqual(result.end, { x: 300, y: 50 });
  });

  it("leaves free-point endpoints unchanged", () => {
    const s1: RectShape = { id: "s1", type: "rectangle", x: 0, y: 0, width: 100, height: 100 };
    const arrow: ArrowShape = {
      id: "arrow1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "s1", anchor: "auto" },
      end: { x: 500, y: 500 },
    };
    const doc: CanvasDocument = { version: 1, shapes: [s1, arrow] };
    const result = resolveArrowRenderEndpoints(doc, arrow);
    assert.deepEqual(result.end, { x: 500, y: 500 });
    assert.deepEqual(result.start, { x: 50, y: 100 });
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

describe("Universal Shapes and Path bounds", () => {
  it("computes bounds correctly for PathShape from points", () => {
    const doc: CanvasDocument = { version: 1, shapes: [] };
    const path = {
      id: "p1",
      type: "path" as const,
      x: 0,
      y: 0,
      points: [
        [10, 20],
        [100, 250],
        [50, 80],
      ] as [number, number][],
    };
    const bounds = getShapeBounds(doc, path);
    assert.equal(bounds.x, 10);
    assert.equal(bounds.y, 20);
    assert.equal(bounds.width, 90);
    assert.equal(bounds.height, 230);
  });

  it("round-trips universal shapes (triangle, cylinder, cloud, hexagon, star, path)", () => {
    const doc: CanvasDocument = {
      version: 1,
      renderMode: "sketchy",
      shapes: [
        { id: "t1", type: "triangle", x: 10, y: 10, width: 100, height: 80, fill: "3" },
        { id: "c1", type: "cylinder", x: 120, y: 10, width: 100, height: 90, fill: "4" },
        { id: "cl1", type: "cloud", x: 230, y: 10, width: 140, height: 90, fill: "5" },
        { id: "h1", type: "hexagon", x: 380, y: 10, width: 110, height: 90, fill: "6" },
        { id: "st1", type: "star", x: 500, y: 10, width: 100, height: 100, fill: "1" },
        { id: "p1", type: "path", x: 0, y: 0, points: [[0, 0], [50, 50]] },
      ],
    };

    const serialized = serializeFreeformDocument(doc);
    const { doc: parsed, errors } = parseFreeformSource(serialized);
    assert.deepEqual(errors, []);
    assert.deepEqual(parsed, doc);
  });

  it("exports a rich CanvasDocument to pure SVG markup", async () => {
    const { freeformToSvg } = await import("./freeform-svg.ts");
    const doc: CanvasDocument = {
      version: 1,
      shapes: [
        { id: "s1", type: "rectangle", x: 50, y: 50, width: 160, height: 80, text: { content: "Box 1" } },
        { id: "s2", type: "cylinder", x: 300, y: 50, width: 140, height: 100, text: { content: "DB" } },
        { id: "a1", type: "arrow", x: 0, y: 0, start: { shapeId: "s1" }, end: { shapeId: "s2" }, label: "calls" },
      ],
    };
    const svg = freeformToSvg(doc);
    assert.ok(svg.startsWith("<svg"));
    assert.ok(svg.includes("Box 1"));
    assert.ok(svg.includes("DB"));
    assert.ok(svg.includes("calls"));
    assert.ok(svg.endsWith("</svg>"));
  });

  it("calculates rotated anchor coordinates accurately for rotated shapes", () => {
    const doc: CanvasDocument = {
      version: 1,
      shapes: [
        { id: "r1", type: "rectangle", x: 100, y: 100, width: 100, height: 100, rotation: 90 },
      ],
    };
    // Center is (150, 150). Unrotated "right" is (200, 150).
    // Rotated 90 deg clockwise around (150, 150) gives (150, 200).
    const p = resolveArrowEndpoint(doc, { shapeId: "r1", anchor: "right" });
    assert.equal(p.x, 150);
    assert.equal(p.y, 200);
  });
});

describe("resolveArrowHeadStyle", () => {
  const base = { id: "a1", x: 0, y: 0, start: { x: 0, y: 0 }, end: { x: 100, y: 0 } };

  it("defaults an arrow to a pointer at the end only", () => {
    const arrow = { ...base, type: "arrow" as const };
    assert.equal(resolveArrowHeadStyle(arrow, "end"), "arrow");
    assert.equal(resolveArrowHeadStyle(arrow, "start"), "none");
  });

  it("defaults a line to no heads at all", () => {
    const line = { ...base, type: "line" as const };
    assert.equal(resolveArrowHeadStyle(line, "end"), "none");
    assert.equal(resolveArrowHeadStyle(line, "start"), "none");
  });

  it("honors the legacy booleans when no style is set", () => {
    const arrow = { ...base, type: "arrow" as const, arrowStart: true, arrowEnd: false };
    assert.equal(resolveArrowHeadStyle(arrow, "start"), "arrow");
    assert.equal(resolveArrowHeadStyle(arrow, "end"), "none");
  });

  it("lets an explicit style win over the booleans, including on a line", () => {
    const arrow = { ...base, type: "arrow" as const, arrowEnd: false, arrowHeadEnd: "diamond" as const };
    assert.equal(resolveArrowHeadStyle(arrow, "end"), "diamond");
    const line = { ...base, type: "line" as const, arrowHeadEnd: "crowfoot-many" as const };
    assert.equal(resolveArrowHeadStyle(line, "end"), "crowfoot-many");
  });
});

describe("computeArrowHeadGeometry", () => {
  const tip = { x: 100, y: 0 };
  const from = { x: 0, y: 0 };

  it("returns nothing for styles the renderers draw themselves", () => {
    assert.equal(computeArrowHeadGeometry(tip, from, "none"), null);
    assert.equal(computeArrowHeadGeometry(tip, from, "arrow"), null);
  });

  it("puts the head apex on the tip and pulls the line back behind it", () => {
    const geom = computeArrowHeadGeometry(tip, from, "triangle-open")!;
    const polygon = geom.marks[0];
    assert.equal(polygon.kind, "polygon");
    assert.deepEqual(polygon.kind === "polygon" ? polygon.points[0] : null, tip);
    // Line stops short of the tip so an open head is not skewered by its own line.
    assert.ok(geom.lineEnd.x < tip.x);
    assert.equal(Math.round(geom.lineEnd.y), 0);
  });

  it("fills a diamond but not an open one", () => {
    const filled = computeArrowHeadGeometry(tip, from, "diamond")!.marks[0];
    const open = computeArrowHeadGeometry(tip, from, "diamond-open")!.marks[0];
    assert.equal(filled.kind === "polygon" && filled.filled, true);
    assert.equal(open.kind === "polygon" && open.filled, false);
  });

  it("orients the head along the segment, not the axis", () => {
    const down = computeArrowHeadGeometry({ x: 0, y: 100 }, { x: 0, y: 0 }, "diamond")!;
    assert.equal(Math.round(down.lineEnd.x), 0);
    assert.ok(down.lineEnd.y < 100);
  });

  it("scales the head with stroke width", () => {
    const thin = computeArrowHeadGeometry(tip, from, "diamond", 1)!;
    const thick = computeArrowHeadGeometry(tip, from, "diamond", 6)!;
    assert.ok(thick.lineEnd.x < thin.lineEnd.x);
  });

  it("gives every crow's-foot cardinality its own mark set", () => {
    const marksFor = (style: Parameters<typeof computeArrowHeadGeometry>[2]) =>
      computeArrowHeadGeometry(tip, from, style)!.marks;

    // "many" is the foot alone: two polylines, no bar, no ring.
    const many = marksFor("crowfoot-many");
    assert.equal(many.every((m) => m.kind === "polyline"), true);
    assert.equal(many.filter((m) => m.kind === "circle").length, 0);

    // "one" is a single bar.
    assert.equal(marksFor("crowfoot-one").length, 1);

    // Optionality adds a ring; the mandatory variants have none.
    for (const style of ["crowfoot-zero-one", "crowfoot-zero-many"] as const) {
      assert.equal(marksFor(style).filter((m) => m.kind === "circle").length, 1);
    }
    for (const style of ["crowfoot-one", "crowfoot-many", "crowfoot-one-many"] as const) {
      assert.equal(marksFor(style).filter((m) => m.kind === "circle").length, 0);
    }

    // "one-many" carries both the bar and the foot.
    assert.equal(marksFor("crowfoot-one-many").length, 3);
  });

  it("clears the ring with the line end so the two do not overlap", () => {
    const geom = computeArrowHeadGeometry(tip, from, "crowfoot-zero-one")!;
    const ring = geom.marks.find((m) => m.kind === "circle")!;
    assert.equal(ring.kind, "circle");
    if (ring.kind !== "circle") return;
    assert.ok(geom.lineEnd.x <= ring.cx - ring.r + 0.001);
  });
});

describe("fitTextFontSize", () => {
  const box = { width: 160, height: 60, fontSize: 14 };

  it("leaves copy that already fits alone", () => {
    assert.equal(fitTextFontSize({ ...box, content: "Short" }), 14);
  });

  it("shrinks copy that would wrap past the shape height", () => {
    const fitted = fitTextFontSize({
      ...box,
      height: 30,
      content: "a much longer label that wraps onto several lines",
    });
    assert.ok(fitted < 14);
  });

  it("never shrinks below 60% of the authored size", () => {
    const fitted = fitTextFontSize({
      width: 60,
      height: 16,
      fontSize: 20,
      content: "an extremely long label that cannot possibly fit in this tiny box",
    });
    assert.equal(fitted, 12);
  });

  it("floors at 8px for small authored sizes", () => {
    const fitted = fitTextFontSize({
      width: 40,
      height: 14,
      fontSize: 10,
      content: "far too much text for this box to ever hold at any size",
    });
    assert.equal(fitted, 8);
  });

  it("never touches wrap:false — ASCII and terminal layouts must not rescale", () => {
    const fitted = fitTextFontSize({
      width: 40,
      height: 16,
      fontSize: 14,
      wrap: false,
      content: "+----------+\n| a box    |\n+----------+",
    });
    assert.equal(fitted, 14);
  });

  it("keeps a single line at full size in a short box", () => {
    // A 20px bar holds one line of 11px type; leading only sits between lines.
    assert.equal(fitTextFontSize({ width: 200, height: 20, fontSize: 11, content: "Completed task" }), 11);
  });

  it("accounts for explicit newlines, not just soft wrapping", () => {
    const fitted = fitTextFontSize({ ...box, height: 34, content: "line one\nline two\nline three" });
    assert.ok(fitted < 14);
  });

  it("shrinks more as the box gets shorter", () => {
    const content = "a label long enough to need two or three lines";
    const roomy = fitTextFontSize({ ...box, height: 50, content });
    const tight = fitTextFontSize({ ...box, height: 24, content });
    assert.ok(tight <= roomy);
  });
});

describe("getShapeBounds — default size when a primitive omits width/height", () => {
  it("gives an unsized rectangle a real, finite fallback instead of undefined", () => {
    const doc: CanvasDocument = { version: 1, shapes: [{ id: "a", type: "rectangle", x: 10, y: 20 } as any] };
    const bounds = getShapeBounds(doc, doc.shapes[0]);
    assert.equal(bounds.x, 10);
    assert.equal(bounds.y, 20);
    assert.ok(Number.isFinite(bounds.width) && bounds.width > 0);
    assert.ok(Number.isFinite(bounds.height) && bounds.height > 0);
  });

  it("still respects an explicit width/height when given", () => {
    const doc: CanvasDocument = { version: 1, shapes: [{ id: "a", type: "diamond", x: 0, y: 0, width: 200, height: 77 }] };
    const bounds = getShapeBounds(doc, doc.shapes[0]);
    assert.equal(bounds.width, 200);
    assert.equal(bounds.height, 77);
  });

  it("gives every primitive type its own sane default, not one universal box", () => {
    const doc: CanvasDocument = { version: 1, shapes: [] };
    const sticky = getShapeBounds(doc, { id: "s", type: "sticky", x: 0, y: 0 } as any);
    const text = getShapeBounds(doc, { id: "t", type: "text", x: 0, y: 0 } as any);
    assert.notEqual(sticky.width, text.width);
  });
});
