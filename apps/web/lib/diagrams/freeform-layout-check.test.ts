import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkLayoutIssues } from "./freeform-layout-check.ts";
import type { CanvasDocument, RectShape, FrameShape, ArrowShape } from "./freeform-canvas.ts";

describe("checkLayoutIssues", () => {
  it("flags two overlapping sibling rectangles", () => {
    const a: RectShape = { id: "s_a", name: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 100 };
    const b: RectShape = { id: "s_b", name: "b", type: "rectangle", x: 30, y: 30, width: 100, height: 100 };
    const doc: CanvasDocument = { version: 1, shapes: [a, b] };

    const issues = checkLayoutIssues(doc);
    assert.ok(issues.some((i) => i.kind === "overlap" && i.shapeIds.includes("s_a") && i.shapeIds.includes("s_b")));
  });

  it("does not flag a shape properly inside its frame", () => {
    const frame: FrameShape = { id: "f_1", name: "frame", type: "frame", x: 0, y: 0, width: 400, height: 300 };
    const child: RectShape = { id: "s_c", name: "child", type: "rectangle", x: 50, y: 50, width: 100, height: 80, frameId: "f_1" };
    const doc: CanvasDocument = { version: 1, shapes: [frame, child] };

    const issues = checkLayoutIssues(doc);
    assert.deepEqual(issues, []);
  });

  it("flags an arrow referencing a nonexistent shape id", () => {
    const arrow: ArrowShape = {
      id: "arr_1",
      name: "arrow",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "does_not_exist" },
      end: { x: 200, y: 200 },
    };
    const doc: CanvasDocument = { version: 1, shapes: [arrow] };

    const issues = checkLayoutIssues(doc);
    assert.ok(issues.some((i) => i.kind === "dangling-arrow-ref" && i.shapeIds.includes("arr_1")));
  });

  it("flags a shape positioned outside its parent frame's bounds", () => {
    const frame: FrameShape = { id: "f_1", name: "frame", type: "frame", x: 0, y: 0, width: 200, height: 200 };
    const outsider: RectShape = { id: "s_o", name: "outsider", type: "rectangle", x: 900, y: 900, width: 100, height: 100, frameId: "f_1" };
    const doc: CanvasDocument = { version: 1, shapes: [frame, outsider] };

    const issues = checkLayoutIssues(doc);
    assert.ok(issues.some((i) => i.kind === "outside-frame" && i.shapeIds.includes("s_o")));
  });
});
