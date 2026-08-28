import { expect, test } from "@playwright/test";
import type { DeterministicChartDatum, DeterministicChartType } from "../apps/web/lib/engine-v2/chart-types.ts";
import type { EngineDocument } from "../apps/web/lib/engine-v2/document.ts";
import {
  serializeEngineV2PrintHtml,
  serializeEngineV2ReactTsx,
  serializeEngineV2Svg,
  supportedEngineV2ExportChartTypes,
} from "../apps/web/lib/engine-v2/export.ts";
import { chartSvgFromGeneratedTsx, readChartGeometry, readNodeLayouts, readPngDimensions, readSvgGeometryForNode, renderGeneratedTsx, type SvgGeometry } from "./helpers/engine-v2-wysiwyg.ts";

function dataFor(type: DeterministicChartType): DeterministicChartDatum[] {
  if (["sunburst", "icicle", "circle-pack"].includes(type)) return [{ path: "Company/Product/API", value: 8 }, { path: "Company/Product/Web", value: 5 }, { path: "Company/Services/Support", value: 3 }];
  if (type === "chord") return [{ source: "A", target: "B", value: 10 }, { source: "B", target: "A", value: 4 }];
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

function mixedDocument(): EngineDocument {
  return {
    version: 2,
    engine: "dom-css",
    name: "Mixed export contract",
    artboard: { width: 900, minHeight: 900, background: "$paper" },
    tokens: {
      colors: { ink: "#15171A", paper: "#F7F8F4", panel: "#FFFFFF", rule: "#D7DBD2", quiet: "#667067", cobalt: "#3157F6", orange: "#FF5D2E" },
      spacing: {},
      radii: {},
    },
    children: [{
      id: "root",
      name: "Report",
      type: "frame",
      layout: { mode: "flex", direction: "column", gap: 20, padding: 28 },
      style: { minHeight: 900, background: "$paper", color: "$ink" },
      children: [
        {
          id: "header",
          name: "Header",
          type: "frame",
          layout: { mode: "flex", direction: "row", gap: 20, padding: 0, align: "center", justify: "space-between" },
          children: [
            { id: "report-title", name: "Title", type: "text", content: "Measured growth", variant: "display" },
            { id: "status", name: "Status", type: "metric", label: "Confidence", value: "92%", detail: "Validated", tone: "positive", style: { width: 210 } },
          ],
        },
        {
          id: "metrics",
          name: "Metrics",
          type: "frame",
          layout: { mode: "grid", columns: 2, gap: 14, padding: 0 },
          children: [
            { id: "revenue", name: "Revenue", type: "metric", label: "Revenue", value: "$18K", detail: "+12%", tone: "positive" },
            { id: "retention", name: "Retention", type: "metric", label: "Retention", value: "94%", detail: "+3 points", tone: "neutral" },
          ],
        },
        {
          id: "growth-graph",
          name: "Growth graph",
          type: "graph",
          title: "Growth system",
          graph: {
            name: "Growth system",
            direction: "LR",
            nodes: [
              { id: "visit", label: "Visit", kind: "process" },
              { id: "activate", label: "Activate", kind: "decision" },
              { id: "retain", label: "Retain", kind: "database" },
            ],
            edges: [
              { id: "visit-activate", source: "visit", target: "activate", label: "qualify" },
              { id: "activate-retain", source: "activate", target: "retain", label: "yes" },
            ],
          },
          style: { minHeight: 330 },
        },
      ],
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

test("Engine v2 mixed documents preserve flow, graphs, PNG size, and print DOM", async ({ page, context }) => {
  const document = mixedDocument();
  await page.addInitScript((value) => localStorage.setItem("drawstack.engine-v2.document.draft", JSON.stringify(value)), document);
  await page.goto("/app/engine-v2");
  await expect(page.getByText("LIVE DOM", { exact: true })).toBeVisible();

  const svgPage = await context.newPage();
  await svgPage.setContent(serializeEngineV2Svg(document));
  const tsxPage = await context.newPage();
  await tsxPage.setContent(renderGeneratedTsx(serializeEngineV2ReactTsx(document)));
  const printPage = await context.newPage();
  await printPage.setContent(serializeEngineV2PrintHtml(document));

  for (const surface of [page, svgPage, tsxPage, printPage]) {
    const layouts = await readNodeLayouts(surface, ["header", "report-title", "status", "metrics", "revenue", "retention"]);
    const byId = new Map(layouts.map((layout) => [layout.id, layout]));
    expect(byId.get("report-title")?.text).toBe("Measured growth");
    expect(byId.get("status")?.text).toContain("Confidence92%Validated");
    expect(byId.get("metrics")?.display).toBe("grid");
    expect(byId.get("revenue")?.y).toBe(byId.get("retention")?.y);
    expect(byId.get("revenue")?.width).toBeCloseTo(byId.get("retention")!.width, 0);
  }

  const previewGraph = await readSvgGeometryForNode(page, "growth-graph");
  const svgGraph = await readSvgGeometryForNode(svgPage, "growth-graph");
  const tsxGraph = await readSvgGeometryForNode(tsxPage, "growth-graph");
  expect(svgGraph.viewBox).toEqual(previewGraph.viewBox);
  expect(svgGraph.labels).toContain("Visit");
  expect(svgGraph.labels).toContain("Activate");
  expect(svgGraph.labels).toContain("Retain");
  expect(tsxGraph).toEqual(svgGraph);

  const artboardBounds = await page.locator('[data-node-id="root"]').boundingBox();
  expect(artboardBounds).not.toBeNull();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const download = await downloadPromise;
  const pngPath = await download.path();
  expect(pngPath).not.toBeNull();
  const png = await readPngDimensions(pngPath!);
  expect(png.width).toBe(Math.round(artboardBounds!.width * 2));
  expect(png.height).toBe(Math.round(artboardBounds!.height * 2));

  const printContract = await printPage.evaluate(() => ({
    bodyWidth: document.body.getBoundingClientRect().width,
    pageRule: [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules]).map((rule) => rule.cssText).find((text) => text.startsWith("@page")) ?? "",
    colorAdjust: getComputedStyle(document.body).getPropertyValue("print-color-adjust"),
  }));
  expect(printContract.bodyWidth).toBe(900);
  expect(printContract.pageRule).toContain("900px 900px");
  expect(printContract.colorAdjust).toBe("exact");

  for (const surface of [page, svgPage, tsxPage, printPage]) {
    await surface.setViewportSize({ width: 390, height: 844 });
    const mobile = new Map((await readNodeLayouts(surface, ["header", "report-title", "status", "metrics", "revenue", "retention"])).map((layout) => [layout.id, layout]));
    expect(mobile.get("header")?.flexDirection).toBe("column");
    expect(mobile.get("status")!.y).toBeGreaterThanOrEqual(mobile.get("report-title")!.y + mobile.get("report-title")!.height);
    expect(mobile.get("retention")!.y).toBeGreaterThanOrEqual(mobile.get("revenue")!.y + mobile.get("revenue")!.height);
  }
});
