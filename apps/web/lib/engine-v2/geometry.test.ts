import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { snapRect, snapResize } from "./geometry.ts";

describe("engine-v2 geometry snapping", () => {
  it("snaps the nearest edges and centers independently", () => {
    const result = snapRect({ x: 96, y: 198, width: 40, height: 20 }, [{ id: "peer", rect: { x: 100, y: 200, width: 40, height: 20 } }], 5);
    assert.deepEqual(result.rect, { x: 100, y: 200, width: 40, height: 20 });
    assert.deepEqual(result.guides.map((guide) => guide.axis), ["x", "y"]);
  });
  it("snaps resize edges without moving the origin", () => {
    const result = snapResize({ x: 10, y: 10, width: 86, height: 86 }, [{ id: "peer", rect: { x: 0, y: 0, width: 100, height: 100 } }], 5);
    assert.equal(result.rect.x, 10);
    assert.equal(result.rect.width, 90);
    assert.equal(result.rect.height, 90);
  });
  it("uses the matched edge offset instead of always aligning left edges", () => {
    const result = snapRect({ x: 50, y: 20, width: 40, height: 20 }, [{ id: "peer", rect: { x: 94, y: 100, width: 40, height: 20 } }], 5);
    assert.equal(result.rect.x, 54);
    assert.equal(result.guides[0].value, 94);
  });
});
