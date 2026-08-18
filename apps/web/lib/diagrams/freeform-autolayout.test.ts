import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { autoLayoutFreeformDocument } from "./freeform-autolayout.ts";
import type { CanvasDocument } from "./freeform-canvas.ts";

describe("autoLayoutFreeformDocument", () => {
  it("arranges a linear chain of nodes horizontally (LR)", () => {
    const doc: CanvasDocument = {
      version: 1,
      shapes: [
        { id: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 60 },
        { id: "b", type: "rectangle", x: 0, y: 0, width: 100, height: 60 },
        { id: "c", type: "rectangle", x: 0, y: 0, width: 100, height: 60 },
        { id: "arr1", type: "arrow", x: 0, y: 0, start: { shapeId: "a" }, end: { shapeId: "b" } },
        { id: "arr2", type: "arrow", x: 0, y: 0, start: { shapeId: "b" }, end: { shapeId: "c" } },
      ],
    };

    const laidOut = autoLayoutFreeformDocument(doc, { direction: "LR", layerGap: 100 });
    const shapeA = laidOut.shapes.find((s) => s.id === "a")!;
    const shapeB = laidOut.shapes.find((s) => s.id === "b")!;
    const shapeC = laidOut.shapes.find((s) => s.id === "c")!;

    assert.ok(shapeA.x < shapeB.x, "A should be to the left of B");
    assert.ok(shapeB.x < shapeC.x, "B should be to the left of C");
  });

  it("arranges a branching tree vertically (TB)", () => {
    const doc: CanvasDocument = {
      version: 1,
      shapes: [
        { id: "root", type: "rectangle", x: 0, y: 0, width: 120, height: 60 },
        { id: "child1", type: "rectangle", x: 0, y: 0, width: 120, height: 60 },
        { id: "child2", type: "rectangle", x: 0, y: 0, width: 120, height: 60 },
        { id: "e1", type: "arrow", x: 0, y: 0, start: { shapeId: "root" }, end: { shapeId: "child1" } },
        { id: "e2", type: "arrow", x: 0, y: 0, start: { shapeId: "root" }, end: { shapeId: "child2" } },
      ],
    };

    const laidOut = autoLayoutFreeformDocument(doc, { direction: "TB", layerGap: 80, nodeGap: 30 });
    const root = laidOut.shapes.find((s) => s.id === "root")!;
    const c1 = laidOut.shapes.find((s) => s.id === "child1")!;
    const c2 = laidOut.shapes.find((s) => s.id === "child2")!;

    assert.ok(root.y < c1.y, "Root should be above child1");
    assert.ok(root.y < c2.y, "Root should be above child2");
    assert.equal(c1.y, c2.y, "Sibling children should be on the same vertical layer");
    assert.notEqual(c1.x, c2.x, "Sibling children should have distinct horizontal positions");
  });

  it("never emits NaN when shapes are missing width/height (the common AI-authored case)", () => {
    const doc: CanvasDocument = {
      version: 1,
      shapes: [
        // No width/height at all -- computeDynamicShapeDimensions used to
        // return undefined for these, which poisoned every downstream sum.
        { id: "a", type: "rectangle", x: 0, y: 0 } as any,
        { id: "b", type: "rectangle", x: 0, y: 0 } as any,
        { id: "c", type: "rectangle", x: 0, y: 0, width: 160, height: 50 },
        { id: "e1", type: "line", x: 0, y: 0, start: { shapeId: "a" }, end: { shapeId: "b" } },
        { id: "e2", type: "line", x: 0, y: 0, start: { shapeId: "b" }, end: { shapeId: "c" } },
      ],
    };

    const laidOut = autoLayoutFreeformDocument(doc, { direction: "LR" });
    for (const s of laidOut.shapes) {
      assert.ok(Number.isFinite(s.x), `${s.id}.x should be finite, got ${s.x}`);
      assert.ok(Number.isFinite(s.y), `${s.id}.y should be finite, got ${s.y}`);
    }
  });
});
