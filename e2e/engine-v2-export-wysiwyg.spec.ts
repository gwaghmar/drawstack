import { expect, test } from "@playwright/test";
import type { DeterministicChartDatum, DeterministicChartType } from "../apps/web/lib/engine-v2/chart-types.ts";
import type { EngineDocument } from "../apps/web/lib/engine-v2/document.ts";
import {
  serializeEngineV2ReactTsx,
  serializeEngineV2Svg,
  supportedEngineV2ExportChartTypes,
} from "../apps/web/lib/engine-v2/export.ts";
import { chartSvgFromGeneratedTsx, readChartGeometry, type SvgGeometry } from "./helpers/engine-v2-wysiwyg.ts";

function dataFor(type: DeterministicChartType): DeterministicChartDatum[] {
  if (type === "scatter") return [{ label: "Alpha", x: 1, y: 3 }, { label: "Beta", x: 4, y: 8 }];
  if (type === "bubble") return [{ label: "Alpha", x: 1, y: 3, size: 12 }, { label: "Beta", x: 4, y: 8, size: 24 }];
  if (type === "heatmap") return [{ row: "North", column: "Q1", value: 3 }, { row: "South", column: "Q1", value: 7 }];
  if (type === "candlestick") return [{ label: "Mon", open: 10, high: 16, low: 8, close: 14 }, { label: "Tue", open: 14, high: 18, low: 12, close: 13 }];
  if (type === "sankey") return [{ source: "Visits", target: "Signup", value: 10 }, { source: "Signup", target: "Paid", value: 4 }];
  if (type === "histogram") return [{ value: 1 }, { value: 2 }, { value: 2.5 }, { value: 4 }];
  if (type === "box-plot") return [{ label: "North", min: 2, q1: 4, median: 6, q3: 8, max: 11 }];
  if (type === "combo") return [{ label: "Q1", value: 10, display: "bar" }, { label: "Q2", value: 14, display: "line" }];
  if (type === "gantt") return [{ label: "Plan", start: "2026-01-01", end: "2026-01-10" }, { label: "Build", start: "2026-01-08", end: "2026-01-24" }];
  if (type === "radar") return [{ label: "Speed", value: 7 }, { label: "Quality", value: 9 }, { label: "Reach", value: 6 }];
  return [
    { label: "Q1", value: 10, series: "Core" },
    { label: "Q2", value: 14, series: "Core" },
    { label: "Q1", value: 6, series: "Plus" },
    { label: "Q2", value: 9, series: "Plus" },
  ];
}

function representativeDocument(): EngineDocument {
  const chartTypes = supportedEngineV2ExportChartTypes();
  return {
    version: 2,
    engine: "dom-css",
    name: "WYSIWYG export contract",
    artboard: { width: 1200, minHeight: Math.ceil(chartTypes.length / 2) * 430, background: "$paper" },
    tokens: {
      colors: { ink: "#15171A", paper: "#F7F8F4", panel: "#FFFFFF", rule: "#D7DBD2", quiet: "#667067", cobalt: "#3157F6", orange: "#FF5D2E" },
      spacing: {},
      radii: {},
    },
    children: [{
      id: "root",
      name: "Chart matrix",
      type: "frame",
      layout: { mode: "grid", columns: 2, gap: 16, padding: 20 },
      children: chartTypes.map((chartType) => ({
        id: `chart-${chartType}`,
        name: `${chartType} chart`,
        type: "chart" as const,
        title: `Contract ${chartType}`,
        chartType,
        data: dataFor(chartType),
        style: { minHeight: 360 },
      })),
    }],
  };
}

function assertHealthyGeometry(metrics: SvgGeometry[], expectedTypes: readonly DeterministicChartType[]) {
  expect(metrics.map((metric) => metric.id)).toEqual(expectedTypes.map((type) => `chart-${type}`));
  for (const metric of metrics) {
    expect(metric.viewBox.width, `${metric.id} viewBox width`).toBeGreaterThan(0);
    expect(metric.viewBox.height, `${metric.id} viewBox height`).toBeGreaterThan(0);
    expect(metric.primitiveCount, `${metric.id} visual primitives`).toBeGreaterThan(0);
    expect(metric.bounds.width, `${metric.id} rendered width`).toBeGreaterThan(0);
    expect(metric.bounds.height, `${metric.id} rendered height`).toBeGreaterThan(0);
    expect(metric.bounds.x, `${metric.id} left clipping`).toBeGreaterThanOrEqual(-4);
    expect(metric.bounds.y, `${metric.id} top clipping`).toBeGreaterThanOrEqual(-4);
    expect(metric.bounds.x + metric.bounds.width, `${metric.id} right clipping`).toBeLessThanOrEqual(metric.viewBox.width + 4);
    expect(metric.bounds.y + metric.bounds.height, `${metric.id} bottom clipping`).toBeLessThanOrEqual(metric.viewBox.height + 4);
    expect(metric.title).toContain(metric.id.slice("chart-".length));
  }
}

test("Engine v2 preview, SVG, and TSX exports preserve chart content and geometry", async ({ page, context }) => {
  const document = representativeDocument();
  const chartTypes = supportedEngineV2ExportChartTypes();
  await page.addInitScript((value) => localStorage.setItem("drawstack.engine-v2.document.draft", JSON.stringify(value)), document);
  await page.goto("/app/engine-v2");
  await expect(page.getByText("LIVE DOM", { exact: true })).toBeVisible();
  await expect(page.locator('[data-node-id^="chart-"]')).toHaveCount(chartTypes.length);

  const preview = await readChartGeometry(page, "main");
  assertHealthyGeometry(preview, chartTypes);

  const svgPage = await context.newPage();
  await svgPage.setContent(serializeEngineV2Svg(document));
  const exportedSvg = await readChartGeometry(svgPage, "foreignObject");
  assertHealthyGeometry(exportedSvg, chartTypes);

  const tsxCharts = chartSvgFromGeneratedTsx(serializeEngineV2ReactTsx(document));
  expect(tsxCharts).toHaveLength(chartTypes.length);
  const tsxPage = await context.newPage();
  await tsxPage.setContent(`<main>${tsxCharts.map((svg, index) => `<section data-node-id="chart-${chartTypes[index]}">${svg}</section>`).join("")}</main>`);
  const exportedTsx = await readChartGeometry(tsxPage, "main");
  assertHealthyGeometry(exportedTsx, chartTypes);

  for (const type of chartTypes) {
    const id = `chart-${type}`;
    const previewChart = preview.find((chart) => chart.id === id)!;
    const svgChart = exportedSvg.find((chart) => chart.id === id)!;
    const tsxChart = exportedTsx.find((chart) => chart.id === id)!;
    expect(tsxChart.title).toBe(svgChart.title);
    expect(tsxChart.viewBox).toEqual(svgChart.viewBox);
    expect(tsxChart.bounds).toEqual(svgChart.bounds);
    expect(tsxChart.primitiveCount).toBe(svgChart.primitiveCount);
  }

  for (const type of ["bar", "line"] as const) {
    const id = `chart-${type}`;
    const previewChart = preview.find((chart) => chart.id === id)!;
    const svgChart = exportedSvg.find((chart) => chart.id === id)!;
    expect(svgChart.viewBox).toEqual(previewChart.viewBox);
    expect(svgChart.bounds).toEqual(previewChart.bounds);
    expect(svgChart.primitiveCount).toBe(previewChart.primitiveCount);
    expect(svgChart.labels).toBe(previewChart.labels);
  }
});
