import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { areaPath, finiteCartesianData, finiteScatterData, formatChartValue, numericDomain, scaleLinear, stackCartesianData } from "./chart-layout.ts";

describe("engine-v2 chart layout", () => {
  it("creates a usable domain for empty and constant values", () => {
    assert.deepEqual(numericDomain([]), { min: 0, max: 1, ticks: [0, 1] });
    const constant = numericDomain([5, 5]);
    assert.ok(constant.min < 5);
    assert.ok(constant.max > 5);
    assert.equal(scaleLinear(constant.min, constant, 100, 0), 100);
    assert.equal(scaleLinear(constant.max, constant, 100, 0), 0);
  });

  it("includes zero for bar domains with negative data", () => {
    const domain = numericDomain([-8, -3], { includeZero: true });
    assert.ok(domain.min <= -8);
    assert.equal(domain.max, 0);
    assert.ok(domain.ticks.includes(0));
  });

  it("filters malformed values without rejecting valid chart data", () => {
    const data = [
      { label: "Good", value: 12 },
      { label: "Bad", value: Number.NaN },
      { label: " ", value: 9 },
      { x: 2, y: 3, label: "Point" },
      { x: Number.POSITIVE_INFINITY, y: 4 },
    ];
    assert.deepEqual(finiteCartesianData(data), [{ label: "Good", value: 12 }]);
    assert.deepEqual(finiteScatterData(data), [{ x: 2, y: 3, label: "Point" }]);
  });

  it("stacks positive and negative series independently", () => {
    const stack = stackCartesianData([
      { label: "Jan", series: "Sales", value: 10 },
      { label: "Jan", series: "Services", value: 5 },
      { label: "Jan", series: "Refunds", value: -3 },
    ]);
    assert.deepEqual(stack.labels, ["Jan"]);
    assert.deepEqual(stack.segments.map(({ start, end }) => [start, end]), [[0, 10], [10, 15], [0, -3]]);
    assert.ok(stack.domain.max >= 15);
    assert.ok(stack.domain.min <= -3);
  });

  it("combines repeated stack cells", () => {
    const stack = stackCartesianData([
      { label: "Jan", series: "Sales", value: 4 },
      { label: "Jan", series: "Sales", value: 6 },
    ]);
    assert.equal(stack.segments[0].value, 10);
    assert.equal(stack.segments[0].end, 10);
  });

  it("formats compact values and creates closed area paths", () => {
    assert.equal(formatChartValue(1250, "$", " ARR"), "$1.25K ARR");
    assert.equal(formatChartValue(-2_000_000), "-2M");
    const path = areaPath([{ x: 10, y: 20 }, { x: 30, y: 5 }], 40);
    assert.equal(path, "M10,40 L10,20 L30,5 L30,40 Z");
    assert.equal(areaPath([], 40), "");
  });
});
