import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { densitySeries, finiteErrorBarData, streamLayers } from "./distribution-layout.ts";

describe("distribution chart layout", () => {
  it("computes deterministic kernel densities from raw samples", () => {
    const first = densitySeries([{ value: 1 }, { value: 2 }, { value: 3 }]);
    const second = densitySeries([{ value: 1 }, { value: 2 }, { value: 3 }]);
    assert.deepEqual(first, second);
    assert.equal(first.series[0].points.length, 48);
    assert.ok(first.maxDensity > 0);
  });

  it("rejects invalid uncertainty bounds", () => {
    assert.equal(finiteErrorBarData([{ label: "A", value: 5, errorLow: 3, errorHigh: 7 } as never]).length, 1);
    assert.equal(finiteErrorBarData([{ label: "A", value: 5, errorLow: 6, errorHigh: 7 } as never]).length, 0);
  });

  it("centers nonnegative streams around zero", () => {
    const layout = streamLayers([
      { label: "Q1", value: 10, series: "A" },
      { label: "Q1", value: 6, series: "B" },
      { label: "Q2", value: 12, series: "A" },
      { label: "Q2", value: 8, series: "B" },
    ]);
    assert.deepEqual(layout.labels, ["Q1", "Q2"]);
    assert.deepEqual(layout.series, ["A", "B"]);
    assert.equal(layout.layers[0].points[0].start, -8);
    assert.equal(layout.layers[1].points[0].end, 8);
  });
});
