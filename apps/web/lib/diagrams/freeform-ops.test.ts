import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyCanvasOps, CanvasOpSchema, type CanvasOp } from "./freeform-ops.ts";
import {
  createEmptyDocument,
  validateFreeformRefs,
  type CanvasDocument,
  type RectShape,
  type FrameShape,
  type ArrowShape,
} from "./freeform-canvas.ts";

function baseDoc(): CanvasDocument {
  const a: RectShape = { id: "s_a", name: "api", type: "rectangle", x: 100, y: 100, width: 160, height: 80 };
  const b: RectShape = { id: "s_b", name: "db", type: "rectangle", x: 400, y: 100, width: 160, height: 80 };
  const c: RectShape = { id: "s_c", name: "db", type: "rectangle", x: 400, y: 300, width: 160, height: 80 };
  return { version: 1, shapes: [a, b, c] };
}

function docNoDupNames(): CanvasDocument {
  const a: RectShape = { id: "s_a", name: "api", type: "rectangle", x: 100, y: 100, width: 160, height: 80 };
  const b: RectShape = { id: "s_b", name: "db", type: "rectangle", x: 400, y: 100, width: 160, height: 80 };
  return { version: 1, shapes: [a, b] };
}

describe("target resolution", () => {
  it("resolves by id", () => {
    const doc = docNoDupNames();
    const result = applyCanvasOps(doc, [{ op: "update", target: "s_a", set: { fill: "1" } }]);
    assert.equal(result.applied, 1);
    assert.equal((result.doc.shapes[0] as RectShape).fill, "1");
  });

  it("resolves by unique name", () => {
    const doc = docNoDupNames();
    const result = applyCanvasOps(doc, [{ op: "update", target: "db", set: { fill: "2" } }]);
    assert.equal(result.applied, 1);
    assert.equal((result.doc.shapes[1] as RectShape).fill, "2");
  });

  it("ambiguous name lists all candidates", () => {
    const doc = baseDoc();
    const result = applyCanvasOps(doc, [{ op: "update", target: "db", set: { fill: "2" } }]);
    assert.equal(result.applied, 0);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /Ambiguous target "db": matches s_b, s_c/);
  });

  it("missing target errors", () => {
    const doc = docNoDupNames();
    const result = applyCanvasOps(doc, [{ op: "delete", target: "nope" }]);
    assert.equal(result.applied, 0);
    assert.match(result.errors[0].message, /not found/);
  });
});

describe("sequential partial application", () => {
  it("op 2 fails, op 3 still applies, one error recorded", () => {
    const doc = docNoDupNames();
    const ops: CanvasOp[] = [
      { op: "update", target: "s_a", set: { fill: "1" } },
      { op: "delete", target: "missing" },
      { op: "update", target: "s_b", set: { fill: "3" } },
    ];
    const result = applyCanvasOps(doc, ops);
    assert.equal(result.applied, 2);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].index, 1);
    assert.equal((result.doc.shapes[0] as RectShape).fill, "1");
    assert.equal((result.doc.shapes[1] as RectShape).fill, "3");
  });
});

describe("add", () => {
  it("fills defaults for a rectangle", () => {
    const doc = createEmptyDocument();
    const result = applyCanvasOps(doc, [{ op: "add", shape: { type: "rectangle" } }]);
    assert.equal(result.applied, 1);
    const shape = result.doc.shapes[0] as RectShape;
    assert.equal(shape.width, 160);
    assert.equal(shape.height, 80);
    assert.equal(shape.x, 0);
    assert.equal(shape.y, 0);
    assert.ok(shape.id.startsWith("s_"));
  });

  it("auto-sizes text shapes with 15% over-estimate", () => {
    const doc = createEmptyDocument();
    const content = "Hello world this is a label";
    const result = applyCanvasOps(doc, [
      { op: "add", shape: { type: "text", text: { content, fontSize: 16 } } },
    ]);
    const shape = result.doc.shapes[0] as RectShape;
    const expectedWidth = Math.round(Math.max(120, content.length * 16 * 0.6 * 1.15));
    assert.equal(shape.width, expectedWidth);
    assert.equal(shape.height, Math.round(16 * 1.5));
  });

  it("explicit width survives untouched even with long text content", () => {
    const doc = createEmptyDocument();
    const content = "This is a very long label that would otherwise auto-size much wider";
    const result = applyCanvasOps(doc, [
      { op: "add", shape: { type: "sticky", width: 300, text: { content, fontSize: 16 } } },
    ]);
    const shape = result.doc.shapes[0] as RectShape;
    assert.equal(shape.width, 300);
  });

  it("repairs id collision by generating a fresh id", () => {
    const doc = docNoDupNames();
    const result = applyCanvasOps(doc, [{ op: "add", shape: { type: "rectangle", id: "s_a" } }]);
    assert.equal(result.applied, 1);
    assert.equal(result.doc.shapes.length, 3);
    assert.notEqual(result.doc.shapes[2].id, "s_a");
  });

  it("rejects name collision", () => {
    const doc = docNoDupNames();
    const result = applyCanvasOps(doc, [{ op: "add", shape: { type: "rectangle", name: "api" } }]);
    assert.equal(result.applied, 0);
    assert.equal(result.doc.shapes.length, 2);
    assert.match(result.errors[0].message, /already exists/);
  });

  it("rejects adding an arrow/line without start and end as a per-op error, not a throw", () => {
    const doc = createEmptyDocument();
    assert.doesNotThrow(() => {
      const result = applyCanvasOps(doc, [{ op: "add", shape: { type: "arrow" } }]);
      assert.equal(result.applied, 0);
      assert.equal(result.doc.shapes.length, 0);
      assert.match(result.errors[0].message, /requires "start" and "end"/);
    });
  });

  it("rounds coordinates to integers", () => {
    const doc = createEmptyDocument();
    const result = applyCanvasOps(doc, [{ op: "add", shape: { type: "rectangle", x: 10.6, y: 20.4 } }]);
    const shape = result.doc.shapes[0] as RectShape;
    assert.equal(shape.x, 11);
    assert.equal(shape.y, 20);
  });
});

describe("update", () => {
  it("applies dotted paths into text block", () => {
    const doc = docNoDupNames();
    const result = applyCanvasOps(doc, [
      { op: "update", target: "s_a", set: { "text.content": "API v2", "text.fontSize": 20 } },
    ]);
    const shape = result.doc.shapes[0] as RectShape;
    assert.equal(shape.text?.content, "API v2");
    assert.equal(shape.text?.fontSize, 20);
  });

  it("creates a text block when none exists", () => {
    const doc = docNoDupNames();
    const result = applyCanvasOps(doc, [{ op: "update", target: "s_a", set: { "text.content": "hi" } }]);
    const shape = result.doc.shapes[0] as RectShape;
    assert.equal(shape.text?.content, "hi");
  });

  it("rounds numeric position/size", () => {
    const doc = docNoDupNames();
    const result = applyCanvasOps(doc, [{ op: "update", target: "s_a", set: { x: 10.9, width: 50.1 } }]);
    const shape = result.doc.shapes[0] as RectShape;
    assert.equal(shape.x, 11);
    assert.equal(shape.width, 50);
  });
});

describe("delete", () => {
  it("cascades: unparents frame children and freezes bound arrow endpoint", () => {
    const frame: FrameShape = { id: "f1", type: "frame", x: 0, y: 0, width: 400, height: 300 };
    const child: RectShape = { id: "c1", type: "rectangle", x: 20, y: 20, width: 100, height: 50, frameId: "f1" };
    const other: RectShape = { id: "c2", type: "rectangle", x: 300, y: 300, width: 100, height: 50 };
    const arrow: ArrowShape = {
      id: "arr1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "c1", anchor: "center" },
      end: { shapeId: "c2", anchor: "center" },
    };
    const doc: CanvasDocument = { version: 1, shapes: [frame, child, other, arrow] };

    const result = applyCanvasOps(doc, [{ op: "delete", target: "c1" }]);
    assert.equal(result.applied, 1);

    const remainingArrow = result.doc.shapes.find((s) => s.id === "arr1") as ArrowShape;
    assert.ok(remainingArrow);
    assert.deepEqual(remainingArrow.start, { x: 70, y: 45 });

    const remainingFrame = result.doc.shapes.find((s) => s.id === "f1");
    assert.ok(remainingFrame);
    assert.equal(result.doc.shapes.find((s) => s.id === "c1"), undefined);
  });

  it("deleting a frame unparents its children", () => {
    const frame: FrameShape = { id: "f1", type: "frame", x: 0, y: 0, width: 400, height: 300 };
    const child: RectShape = { id: "c1", type: "rectangle", x: 20, y: 20, width: 100, height: 50, frameId: "f1" };
    const doc: CanvasDocument = { version: 1, shapes: [frame, child] };
    const result = applyCanvasOps(doc, [{ op: "delete", target: "f1" }]);
    const remainingChild = result.doc.shapes.find((s) => s.id === "c1") as RectShape;
    assert.equal(remainingChild.frameId, null);
  });

  it("deleting an arrow just removes it", () => {
    const a: RectShape = { id: "s_a", type: "rectangle", x: 0, y: 0, width: 100, height: 50 };
    const b: RectShape = { id: "s_b", type: "rectangle", x: 200, y: 0, width: 100, height: 50 };
    const arrow: ArrowShape = { id: "arr1", type: "arrow", x: 0, y: 0, start: { shapeId: "s_a" }, end: { shapeId: "s_b" } };
    const doc: CanvasDocument = { version: 1, shapes: [a, b, arrow] };
    const result = applyCanvasOps(doc, [{ op: "delete", target: "arr1" }]);
    assert.equal(result.doc.shapes.length, 2);
  });
});

describe("connect", () => {
  it("creates an arrow between two shapes", () => {
    const doc = docNoDupNames();
    const result = applyCanvasOps(doc, [{ op: "connect", from: "s_a", to: "s_b", label: "reads" }]);
    assert.equal(result.applied, 1);
    const arrow = result.doc.shapes.find((s) => s.type === "arrow") as ArrowShape;
    assert.ok(arrow);
    assert.deepEqual(arrow.start, { shapeId: "s_a", anchor: "auto" });
    assert.deepEqual(arrow.end, { shapeId: "s_b", anchor: "auto" });
    assert.equal(arrow.label, "reads");
  });

  it("creates a routed connector with waypoints and junction markers", () => {
    const parsed = CanvasOpSchema.parse({
      op: "connect",
      from: "s_a",
      to: "s_b",
      routing: "orthogonal",
      waypoints: [{ x: 280.4, y: 140.6 }],
      showJunctions: true,
    }) as CanvasOp;
    const result = applyCanvasOps(docNoDupNames(), [parsed]);
    const arrow = result.doc.shapes.find((shape) => shape.type === "arrow") as ArrowShape;

    assert.equal(result.applied, 1);
    assert.equal(arrow.routing, "orthogonal");
    assert.deepEqual(arrow.waypoints, [{ x: 280, y: 141 }]);
    assert.equal(arrow.showJunctions, true);
  });

  it("refuses to connect from/to an arrow", () => {
    const a: RectShape = { id: "s_a", type: "rectangle", x: 0, y: 0, width: 100, height: 50 };
    const b: RectShape = { id: "s_b", type: "rectangle", x: 200, y: 0, width: 100, height: 50 };
    const arrow: ArrowShape = { id: "arr1", type: "arrow", x: 0, y: 0, start: { shapeId: "s_a" }, end: { shapeId: "s_b" } };
    const doc: CanvasDocument = { version: 1, shapes: [a, b, arrow] };
    const result = applyCanvasOps(doc, [{ op: "connect", from: "arr1", to: "s_b" }]);
    assert.equal(result.applied, 0);
    assert.match(result.errors[0].message, /cannot be an arrow\/line/);
  });
});

describe("place", () => {
  function twoShapes(): CanvasDocument {
    const a: RectShape = { id: "s_a", name: "a", type: "rectangle", x: 100, y: 100, width: 160, height: 80 };
    const b: RectShape = { id: "s_b", name: "b", type: "rectangle", x: 0, y: 0, width: 100, height: 60 };
    return { version: 1, shapes: [a, b] };
  }

  it("below with default gap and center align", () => {
    const result = applyCanvasOps(twoShapes(), [{ op: "place", target: "b", below: "a" }]);
    const b = result.doc.shapes.find((s) => s.id === "s_b") as RectShape;
    assert.equal(b.y, 100 + 80 + 60);
    assert.equal(b.x, 100 + 160 / 2 - 100 / 2);
  });

  it("above with custom gap", () => {
    const result = applyCanvasOps(twoShapes(), [{ op: "place", target: "b", above: "a", gap: 20 }]);
    const b = result.doc.shapes.find((s) => s.id === "s_b") as RectShape;
    assert.equal(b.y, 100 - 20 - 60);
  });

  it("rightOf and leftOf", () => {
    const r1 = applyCanvasOps(twoShapes(), [{ op: "place", target: "b", rightOf: "a" }]);
    const b1 = r1.doc.shapes.find((s) => s.id === "s_b") as RectShape;
    assert.equal(b1.x, 100 + 160 + 60);

    const r2 = applyCanvasOps(twoShapes(), [{ op: "place", target: "b", leftOf: "a" }]);
    const b2 = r2.doc.shapes.find((s) => s.id === "s_b") as RectShape;
    assert.equal(b2.x, 100 - 60 - 100);
  });

  it("align start and end", () => {
    const rStart = applyCanvasOps(twoShapes(), [{ op: "place", target: "b", below: "a", align: "start" }]);
    const bStart = rStart.doc.shapes.find((s) => s.id === "s_b") as RectShape;
    assert.equal(bStart.x, 100);

    const rEnd = applyCanvasOps(twoShapes(), [{ op: "place", target: "b", below: "a", align: "end" }]);
    const bEnd = rEnd.doc.shapes.find((s) => s.id === "s_b") as RectShape;
    assert.equal(bEnd.x, 100 + 160 - 100);
  });

  it("inside a frame positions at padded origin when unplaced", () => {
    const frame: FrameShape = { id: "f1", name: "frame", type: "frame", x: 50, y: 50, width: 400, height: 300 };
    const shape: RectShape = { id: "s_x", name: "x", type: "rectangle", x: 0, y: 0, width: 100, height: 50 };
    const doc: CanvasDocument = { version: 1, shapes: [frame, shape] };
    const result = applyCanvasOps(doc, [{ op: "place", target: "x", inside: "frame" }]);
    const placed = result.doc.shapes.find((s) => s.id === "s_x") as RectShape;
    assert.equal(placed.frameId, "f1");
    assert.equal(placed.x, 50 + 24);
    assert.equal(placed.y, 50 + 24);
  });

  it("inside a non-frame errors", () => {
    const doc = twoShapes();
    const result = applyCanvasOps(doc, [{ op: "place", target: "b", inside: "a" }]);
    assert.equal(result.applied, 0);
    assert.match(result.errors[0].message, /is not a frame/);
  });

  it("requires exactly one ref", () => {
    const doc = twoShapes();
    const result = applyCanvasOps(doc, [{ op: "place", target: "b", below: "a", above: "a" }]);
    assert.equal(result.applied, 0);
    assert.match(result.errors[0].message, /exactly one of/);

    const result2 = applyCanvasOps(doc, [{ op: "place", target: "b" }]);
    assert.equal(result2.applied, 0);
    assert.match(result2.errors[0].message, /exactly one of/);
  });
});

describe("layout", () => {
  function threeShapes(): CanvasDocument {
    const a: RectShape = { id: "s_a", name: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 50 };
    const b: RectShape = { id: "s_b", name: "b", type: "rectangle", x: 0, y: 0, width: 100, height: 50 };
    const c: RectShape = { id: "s_c", name: "c", type: "rectangle", x: 0, y: 0, width: 100, height: 50 };
    return { version: 1, shapes: [a, b, c] };
  }

  it("arranges in a row", () => {
    const result = applyCanvasOps(threeShapes(), [
      { op: "layout", targets: ["a", "b", "c"], arrange: "row", gap: 10, origin: { x: 0, y: 0 } },
    ]);
    const xs = ["s_a", "s_b", "s_c"].map((id) => (result.doc.shapes.find((s) => s.id === id) as RectShape).x);
    assert.deepEqual(xs, [0, 110, 220]);
  });

  it("arranges in a column", () => {
    const result = applyCanvasOps(threeShapes(), [
      { op: "layout", targets: ["a", "b", "c"], arrange: "column", gap: 10, origin: { x: 0, y: 0 } },
    ]);
    const ys = ["s_a", "s_b", "s_c"].map((id) => (result.doc.shapes.find((s) => s.id === id) as RectShape).y);
    assert.deepEqual(ys, [0, 60, 120]);
  });

  it("arranges in a grid", () => {
    const doc = threeShapes();
    const result = applyCanvasOps(doc, [
      { op: "layout", targets: ["a", "b", "c"], arrange: "grid", gap: 10, origin: { x: 0, y: 0 } },
    ]);
    const a = result.doc.shapes.find((s) => s.id === "s_a") as RectShape;
    const b = result.doc.shapes.find((s) => s.id === "s_b") as RectShape;
    const c = result.doc.shapes.find((s) => s.id === "s_c") as RectShape;
    assert.equal(a.x, 0);
    assert.equal(a.y, 0);
    assert.equal(b.x, 110);
    assert.equal(b.y, 0);
    assert.equal(c.x, 0);
    assert.equal(c.y, 60);
  });

  it("skips arrow targets with a per-target error", () => {
    const a: RectShape = { id: "s_a", name: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 50 };
    const b: RectShape = { id: "s_b", name: "b", type: "rectangle", x: 200, y: 0, width: 100, height: 50 };
    const arrow: ArrowShape = { id: "arr1", name: "ar", type: "arrow", x: 0, y: 0, start: { shapeId: "s_a" }, end: { shapeId: "s_b" } };
    const doc: CanvasDocument = { version: 1, shapes: [a, b, arrow] };
    const result = applyCanvasOps(doc, [{ op: "layout", targets: ["a", "b", "ar"], arrange: "row" }]);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /is an arrow\/line/);
    assert.equal(result.applied, 1);
  });
});

describe("reorder", () => {
  function threeShapes(): CanvasDocument {
    const a: RectShape = { id: "s_a", name: "a", type: "rectangle", x: 0, y: 0, width: 10, height: 10 };
    const b: RectShape = { id: "s_b", name: "b", type: "rectangle", x: 0, y: 0, width: 10, height: 10 };
    const c: RectShape = { id: "s_c", name: "c", type: "rectangle", x: 0, y: 0, width: 10, height: 10 };
    return { version: 1, shapes: [a, b, c] };
  }

  it("front moves to end", () => {
    const result = applyCanvasOps(threeShapes(), [{ op: "reorder", target: "a", to: "front" }]);
    assert.deepEqual(result.doc.shapes.map((s) => s.id), ["s_b", "s_c", "s_a"]);
  });

  it("back moves to start", () => {
    const result = applyCanvasOps(threeShapes(), [{ op: "reorder", target: "c", to: "back" }]);
    assert.deepEqual(result.doc.shapes.map((s) => s.id), ["s_c", "s_a", "s_b"]);
  });

  it("forward moves one step", () => {
    const result = applyCanvasOps(threeShapes(), [{ op: "reorder", target: "a", to: "forward" }]);
    assert.deepEqual(result.doc.shapes.map((s) => s.id), ["s_b", "s_a", "s_c"]);
  });

  it("backward moves one step", () => {
    const result = applyCanvasOps(threeShapes(), [{ op: "reorder", target: "c", to: "backward" }]);
    assert.deepEqual(result.doc.shapes.map((s) => s.id), ["s_a", "s_c", "s_b"]);
  });
});

describe("immutability", () => {
  it("never mutates the input document", () => {
    const doc = docNoDupNames();
    Object.freeze(doc);
    Object.freeze(doc.shapes);
    doc.shapes.forEach((s) => Object.freeze(s));

    assert.doesNotThrow(() => {
      applyCanvasOps(doc, [
        { op: "update", target: "s_a", set: { fill: "1" } },
        { op: "add", shape: { type: "rectangle", name: "new" } },
        { op: "connect", from: "s_a", to: "s_b" },
      ]);
    });
  });
});

describe("post-validate", () => {
  it("catches new invalid refs introduced by ops", () => {
    const a: RectShape = { id: "s_a", name: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 50 };
    const arrow: ArrowShape = { id: "arr1", type: "arrow", x: 0, y: 0, start: { shapeId: "s_a" }, end: { shapeId: "s_a" } };
    const doc: CanvasDocument = { version: 1, shapes: [a, arrow] };
    const result = applyCanvasOps(doc, [{ op: "update", target: "arr1", set: { end: { shapeId: "missing" } } }]);
    const postErrors = result.errors.filter((e) => e.op === "post-validate");
    assert.equal(postErrors.length, 1);
    assert.match(postErrors[0].message, /references missing shape "missing"/);
    assert.equal(postErrors[0].index, -1);
  });
});

describe("arrow-to-arrow binding validation (freeform-canvas)", () => {
  it("flags an arrow endpoint bound to another arrow/line", () => {
    const a: RectShape = { id: "s_a", type: "rectangle", x: 0, y: 0, width: 100, height: 50 };
    const arrow1: ArrowShape = { id: "arr1", type: "arrow", x: 0, y: 0, start: { shapeId: "s_a" }, end: { x: 200, y: 200 } };
    const arrow2: ArrowShape = { id: "arr2", type: "line", x: 0, y: 0, start: { shapeId: "arr1" }, end: { x: 300, y: 300 } };
    const doc: CanvasDocument = { version: 1, shapes: [a, arrow1, arrow2] };
    const errors = validateFreeformRefs(doc);
    assert.ok(errors.some((e) => e.includes('Arrow arr2 endpoint may not bind to arrow/line "arr1"')));
  });
});

describe("universal shapes and connector options in applyCanvasOps", () => {
  it("adds triangle, cylinder, cloud, hexagon, and star shapes with defaults", () => {
    const doc: CanvasDocument = { version: 1, shapes: [] };
    const result = applyCanvasOps(doc, [
      { op: "add", shape: { type: "triangle", name: "tri" } },
      { op: "add", shape: { type: "cylinder", name: "db" } },
      { op: "add", shape: { type: "cloud", name: "api" } },
      { op: "add", shape: { type: "hexagon", name: "hex" } },
      { op: "add", shape: { type: "star", name: "star" } },
    ]);

    assert.equal(result.applied, 5);
    assert.equal(result.errors.length, 0);
    assert.equal(result.doc.shapes.length, 5);
    const dbShape = result.doc.shapes.find((s) => s.name === "db") as any;
    assert.equal(dbShape.type, "cylinder");
    assert.equal(dbShape.width, 160);
    assert.equal(dbShape.height, 100);
  });

  it("connects shapes with orthogonal routing and arrowStart/arrowEnd flags", () => {
    const doc: CanvasDocument = {
      version: 1,
      shapes: [
        { id: "s1", type: "rectangle", x: 0, y: 0, width: 100, height: 50 },
        { id: "s2", type: "cylinder", x: 200, y: 200, width: 100, height: 80 },
      ],
    };

    const result = applyCanvasOps(doc, [
      {
        op: "connect",
        from: "s1",
        to: "s2",
        label: "queries",
        routing: "orthogonal",
        arrowStart: true,
        arrowEnd: true,
      },
    ]);

    assert.equal(result.applied, 1);
    assert.equal(result.errors.length, 0);
    const arrow = result.doc.shapes.find((s) => s.type === "arrow") as ArrowShape;
    assert.ok(arrow);
    assert.equal(arrow.label, "queries");
    assert.equal(arrow.routing, "orthogonal");
    assert.equal(arrow.arrowStart, true);
    assert.equal(arrow.arrowEnd, true);
  });
});
