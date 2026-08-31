import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSnapGuides, canvasAccessibilityLabel, snapRect } from "./snapping.ts";

describe("engine v3 snapping primitives", () => {
  it("snaps to the nearest eligible edge or center and reports guides", () => {
    const guides = buildSnapGuides([{ id: "target", x: 100, y: 40, width: 80, height: 60 }, { id: "moving", x: 0, y: 0, width: 20, height: 20 }], new Set(["moving"]));
    const result = snapRect({ id: "moving", x: 78, y: 21, width: 20, height: 20 }, guides, 6);
    assert.equal(result.x, 80);
    assert.equal(result.y, 20);
    assert.deepEqual(result.guides.map((guide) => guide.axis), ["x", "y"]);
  });

  it("keeps distant rectangles unchanged and provides a useful accessible label", () => {
    const result = snapRect({ id: "moving", x: 0, y: 0, width: 10, height: 10 }, buildSnapGuides([{ id: "target", x: 100, y: 100, width: 10, height: 10 }]), 4);
    assert.deepEqual(result, { x: 0, y: 0, guides: [] });
    assert.match(canvasAccessibilityLabel("Report", 1, "Overview"), /editable canvas/);
  });
});
