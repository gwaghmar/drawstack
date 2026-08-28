import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  areaPath,
  finiteCandlestickData,
  finiteCartesianData,
  finiteHeatmapData,
  finiteSankeyData,
  finiteScatterData,
  formatChartValue,
  interpolateHexColor,
  hasSankeyCycle,
  layoutSankey,
  layoutTreemap,
  layoutWaterfall,
  numericDomain,
  polarPoint,
  scaleLinear,
  stackCartesianData,
} from "./chart-layout.ts";

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

  it("filters heatmap cells and normalizes malformed candle ranges", () => {
    const heatmap = finiteHeatmapData([
      { row: "Mon", column: "AM", value: 8 },
      { row: "", column: "PM", value: 3 },
      { row: "Tue", column: "PM", value: Number.NaN },
    ]);
    assert.deepEqual(heatmap, [{ row: "Mon", column: "AM", value: 8 }]);

    const candles = finiteCandlestickData([
      { label: "Day 1", open: 12, high: 10, low: 14, close: 13 },
      { label: "Day 2", open: 10, high: Number.NaN, low: 8, close: 9 },
    ]);
    assert.deepEqual(candles, [{ label: "Day 1", open: 12, high: 14, low: 10, close: 13 }]);
  });

  it("creates deterministic treemap rectangles that preserve area", () => {
    const rectangles = layoutTreemap([
      { label: "A", value: 50 },
      { label: "B", value: 30 },
      { label: "C", value: 20 },
      { label: "Ignored", value: 0 },
    ], 400, 200);
    assert.deepEqual(rectangles.map(({ label }) => label), ["A", "B", "C"]);
    const area = rectangles.reduce((sum, rectangle) => sum + rectangle.width * rectangle.height, 0);
    assert.ok(Math.abs(area - 80_000) < 0.001);
    assert.ok(rectangles.every((rectangle) => rectangle.width > 0 && rectangle.height > 0));
  });

  it("clamps color interpolation and calculates polar points", () => {
    assert.equal(interpolateHexColor("#000000", "#ffffff", 0.5), "#808080");
    assert.equal(interpolateHexColor("#000000", "#ffffff", 2), "#ffffff");
    assert.equal(interpolateHexColor("invalid", "#3157F6", 0.5), "#3157F6");
    const point = polarPoint(10, 10, 5, 0);
    assert.equal(point.x, 15);
    assert.equal(point.y, 10);
  });

  it("lays out proportional acyclic Sankey flows", () => {
    const data = finiteSankeyData([
      { source: "Visits", target: "Signup", value: 80 },
      { source: "Signup", target: "Paid", value: 30 },
      { source: "Signup", target: "Churn", value: 50 },
      { source: "Ignored", target: "Ignored", value: 10 },
      { source: "Bad", target: "Value", value: -1 },
    ]);
    assert.equal(data.length, 3);
    assert.equal(hasSankeyCycle(data), false);
    const layout = layoutSankey(data, 540, 240);
    assert.ok(layout);
    assert.equal(layout.nodes.length, 4);
    assert.equal(layout.links.length, 3);
    assert.ok(layout.links.every((link) => link.width > 0 && link.path.startsWith("M")));
    assert.ok(layout.nodes.find((node) => node.id === "Visits")!.x < layout.nodes.find((node) => node.id === "Signup")!.x);
  });

  it("rejects cyclic Sankey flows", () => {
    const data = [
      { source: "A", target: "B", value: 3 },
      { source: "B", target: "A", value: 2 },
    ];
    assert.equal(hasSankeyCycle(data), true);
    assert.equal(layoutSankey(data, 500, 200), null);
  });

  it("builds waterfall steps from ordered changes", () => {
    const waterfall = layoutWaterfall([
      { label: "Revenue", value: 100 },
      { label: "Returns", value: -25 },
      { label: "Expansion", value: 40 },
    ]);
    assert.deepEqual(waterfall.steps.map(({ start, end }) => [start, end]), [[0, 100], [100, 75], [75, 115]]);
    assert.ok(waterfall.domain.min <= 0);
    assert.ok(waterfall.domain.max >= 115);
  });
});
