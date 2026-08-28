import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EngineDocument } from "./document.ts";
import {
  createEngineV2JsonExport,
  createEngineV2PrintHtmlExport,
  createEngineV2ReactTsxExport,
  createEngineV2SvgExport,
  engineV2ExportFilename,
  serializeEngineV2PrintHtml,
  serializeEngineV2ReactTsx,
  serializeEngineV2Svg,
  supportedEngineV2ExportChartTypes,
} from "./export.ts";

function exportDocument(): EngineDocument {
  return {
    version: 2,
    engine: "dom-css",
    name: "Quarterly Revenue & Flow",
    artboard: { width: 1080, minHeight: 720, background: "$paper" },
    tokens: {
      colors: { ink: "#15171A", paper: "#F7F8F4", panel: "#FFFFFF", rule: "#D7DBD2", quiet: "#667067", cobalt: "#3157F6", orange: "#FF5D2E" },
      spacing: {},
      radii: {},
    },
    children: [{
      id: "root",
      name: "Root",
      type: "frame",
      layout: { mode: "grid", columns: 2, gap: 16, padding: 24 },
      children: [
        { id: "heading", name: "Heading", type: "text", content: "Revenue < target", variant: "heading" },
        { id: "metric", name: "Metric", type: "metric", label: "Revenue", value: "$14K", detail: "+12%", tone: "positive" },
        {
          id: "chart",
          name: "Chart",
          type: "chart",
          title: "Revenue trend",
          chartType: "line",
          data: [{ label: "Jan", value: 10 }, { label: "Feb", value: 14 }],
          valuePrefix: "$",
        },
        {
          id: "flow",
          name: "Flow",
          type: "graph",
          title: "Request flow",
          graph: {
            name: "Request flow",
            direction: "LR",
            nodes: [
              { id: "client", label: "Client", kind: "person" },
              { id: "api", label: "API", kind: "service" },
            ],
            edges: [{ id: "request", source: "client", target: "api", kind: "flow", label: "request" }],
          },
        },
      ],
    }],
  };
}

describe("Engine v2 export payloads", () => {
  it("creates a stable JSON download payload", () => {
    const document = exportDocument();
    const payload = createEngineV2JsonExport(document);
    assert.deepEqual({ filename: payload.filename, mimeType: payload.mimeType }, {
      filename: "quarterly-revenue-flow.json",
      mimeType: "application/json;charset=utf-8",
    });
    assert.deepEqual(JSON.parse(payload.contents), document);
    assert.ok(payload.contents.endsWith("\n"));
  });

  it("normalizes empty and punctuation-only filenames", () => {
    assert.equal(engineV2ExportFilename(" !!! ", "svg"), "drawstack.svg");
  });
});

describe("serializeEngineV2Svg", () => {
  it("serializes the DOM layout, chart data, and graph geometry", () => {
    const svg = serializeEngineV2Svg(exportDocument());
    assert.match(svg, /^<\?xml version="1\.0"/);
    assert.match(svg, /<foreignObject/);
    assert.match(svg, /data-layout="grid"/);
    assert.match(svg, /Revenue trend/);
    assert.match(svg, /<path d="M/);
    assert.match(svg, /Request flow/);
    assert.match(svg, /<polyline points=/);
    assert.match(svg, /Revenue &lt; target/);
    assert.doesNotMatch(svg, /Revenue < target/);
    assert.deepEqual(createEngineV2SvgExport(exportDocument()).filename, "quarterly-revenue-flow.svg");
  });

  it("supports every deterministic chart family", () => {
    const document = exportDocument();
    const root = document.children[0];
    assert.equal(root.type, "frame");
    if (root.type !== "frame") return;
    for (const chartType of supportedEngineV2ExportChartTypes()) {
      const chart = root.children.find((node) => node.type === "chart");
      assert.ok(chart && chart.type === "chart");
      if (!chart || chart.type !== "chart") return;
      chart.chartType = chartType;
      chart.data = chartType === "scatter"
        ? [{ label: "A", x: 1, y: 2 }, { label: "B", x: 2, y: 4 }]
        : chartType === "bubble"
          ? [{ label: "A", x: 1, y: 2, size: 10 }, { label: "B", x: 2, y: 4, size: 25 }]
        : chartType === "histogram"
          ? [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 8 }]
        : chartType === "box-plot"
          ? [{ label: "A", min: 1, q1: 2, median: 3, q3: 4, max: 6 }]
        : chartType === "combo"
          ? [{ label: "Jan", value: 10, series: "Revenue", display: "bar" }, { label: "Jan", value: 22, series: "Margin", display: "line", axis: "right" }]
        : chartType === "gantt"
          ? [{ label: "Design", start: "2026-01-01", end: "2026-01-12" }, { label: "Build", start: "2026-01-08", end: "2026-01-28" }]
        : chartType === "sankey"
          ? [{ source: "Visits", target: "Signup", value: 10 }, { source: "Signup", target: "Paid", value: 4 }]
        : chartType === "heatmap"
          ? [{ row: "North", column: "Q1", value: 3 }, { row: "South", column: "Q1", value: 5 }]
          : chartType === "candlestick"
            ? [{ label: "Mon", open: 10, high: 14, low: 8, close: 12 }, { label: "Tue", open: 12, high: 16, low: 11, close: 15 }]
            : [{ label: "A", value: 1, series: "One" }, { label: "B", value: 2, series: "Two" }, { label: "C", value: 3, series: "One" }];
      const svg = serializeEngineV2Svg(document);
      assert.match(svg, new RegExp(`deterministic ${chartType}`));
      assert.doesNotMatch(svg, /No chart data/);
      if (chartType === "sankey") assert.match(svg, /Visits to Signup/);
      const tsx = serializeEngineV2ReactTsx(document);
      assert.match(tsx, new RegExp(`deterministic ${chartType}`));
      assert.doesNotMatch(tsx, /No chart data/);
    }
  });
});

describe("serializeEngineV2PrintHtml", () => {
  it("creates a self-contained print and PDF-ready document", () => {
    const html = serializeEngineV2PrintHtml(exportDocument());
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /@page\{size:1080px 720px;margin:0\}/);
    assert.match(html, /print-color-adjust:exact/);
    assert.match(html, /break-inside:avoid/);
    assert.match(html, /<svg class="engine-chart"/);
    assert.match(html, /<svg class="engine-graph"/);
    const payload = createEngineV2PrintHtmlExport(exportDocument());
    assert.equal(payload.mimeType, "text/html;charset=utf-8");
    assert.equal(payload.filename, "quarterly-revenue-flow.html");
  });
});

describe("serializeEngineV2ReactTsx", () => {
  it("creates a self-contained React component with editable JSX nodes", () => {
    const tsx = serializeEngineV2ReactTsx(exportDocument());
    assert.match(tsx, /^export default function QuarterlyRevenueFlowGraphic\(\)/);
    assert.match(tsx, /<main className="engine-artboard"/);
    assert.match(tsx, /<div className="engine-frame"/);
    assert.match(tsx, /<svg className="engine-chart"/);
    assert.match(tsx, /<svg className="engine-graph"/);
    assert.match(tsx, /strokeWidth="3"/);
    assert.match(tsx, /\{"Revenue < target"\}/);
    assert.match(tsx, /\.engine-artboard,.engine-artboard \*\{box-sizing:border-box\}/);
    assert.doesNotMatch(tsx, /dangerouslySetInnerHTML/);
    assert.doesNotMatch(tsx, /@\/|@components|@lib/);
    assert.doesNotMatch(tsx, /html,body|(?:^|\n)body\{/);
  });

  it("creates a deterministic TSX download payload", () => {
    const first = createEngineV2ReactTsxExport(exportDocument());
    const second = createEngineV2ReactTsxExport(exportDocument());
    assert.deepEqual(first, second);
    assert.equal(first.filename, "quarterly-revenue-flow.tsx");
    assert.equal(first.mimeType, "text/typescript;charset=utf-8");
  });
});
