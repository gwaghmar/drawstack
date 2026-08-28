import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHART_FAMILY_REGISTRY,
  CHART_FAMILY_TYPES,
  CHART_RENDERER_KEYS,
  exportRendererForChart,
  previewRendererForChart,
  type RegisteredChartType,
} from "./chart-registry.ts";
import { validateChartFamilyData } from "./chart-validation.ts";
import type { DeterministicChartDatum } from "./chart-types.ts";
import { validateEngineV2Document } from "./compiler.ts";
import type { EngineDocument } from "./document.ts";
import {
  serializeEngineV2PrintHtml,
  serializeEngineV2ReactTsx,
  serializeEngineV2Svg,
  supportedEngineV2ExportChartTypes,
} from "./export.ts";

function dataFor(type: RegisteredChartType): DeterministicChartDatum[] {
  const contract = CHART_FAMILY_REGISTRY[type].dataContract;
  if (contract === "hierarchy") return [{ path: "Company/Product/API", value: 8 }, { path: "Company/Product/Web", value: 5 }, { path: "Company/Services/Support", value: 3 }];
  if (contract === "scatter") return [{ label: "A", x: 1, y: 2 }, { label: "B", x: 3, y: 5 }];
  if (contract === "heatmap") return [{ row: "North", column: "Q1", value: 3 }, { row: "South", column: "Q1", value: 5 }];
  if (contract === "candlestick") return [{ label: "Mon", open: 10, high: 14, low: 8, close: 12 }];
  if (contract === "sankey") return type === "chord" ? [{ source: "A", target: "B", value: 10 }, { source: "B", target: "A", value: 4 }] : [{ source: "Visits", target: "Signup", value: 10 }, { source: "Signup", target: "Paid", value: 4 }];
  if (contract === "histogram") return [{ value: 1 }, { value: 2 }, { value: 4 }];
  if (contract === "box-plot") return [{ label: "North", min: 1, q1: 2, median: 3, q3: 4, max: 6 }];
  if (contract === "bubble") return [{ label: "A", x: 1, y: 2, size: 10 }, { label: "B", x: 3, y: 5, size: 20 }];
  if (contract === "combo") return [{ label: "Q1", value: 10, series: "Revenue", display: "bar" }, { label: "Q1", value: 20, series: "Margin", display: "line", axis: "right" }];
  if (contract === "gantt") return [{ label: "Design", start: "2026-01-01", end: "2026-01-12" }];
  return [
    { label: "Q1", value: 10, series: "Core" },
    { label: "Q2", value: 14, series: "Core" },
    { label: "Q3", value: 12, series: "Core" },
    { label: "Q1", value: 5, series: "Plus" },
    { label: "Q2", value: 8, series: "Plus" },
    { label: "Q3", value: 7, series: "Plus" },
  ];
}

function documentFor(type: RegisteredChartType, data: DeterministicChartDatum[]): EngineDocument {
  return {
    version: 2,
    engine: "dom-css",
    name: `${type} registry contract`,
    artboard: { width: 800, minHeight: 500, background: "$paper" },
    tokens: {
      colors: { ink: "#15171A", paper: "#F7F8F4", panel: "#FFFFFF", rule: "#D7DBD2", quiet: "#667067" },
      spacing: {},
      radii: {},
    },
    children: [{ id: `chart-${type}`, name: `${type} chart`, type: "chart", title: `Contract ${type}`, chartType: type, data }],
  };
}

describe("chart family registry parity", () => {
  it("gives every registered family validation, preview, SVG, print, and TSX support", () => {
    assert.deepEqual(supportedEngineV2ExportChartTypes(), CHART_FAMILY_TYPES);
    for (const type of CHART_FAMILY_TYPES) {
      const data = dataFor(type);
      assert.deepEqual(validateChartFamilyData(type, data), [], `${type} validation contract`);
      assert.ok(CHART_RENDERER_KEYS.includes(previewRendererForChart(type)), `${type} preview dispatch`);
      assert.ok(CHART_RENDERER_KEYS.includes(exportRendererForChart(type)), `${type} export dispatch`);

      const document = documentFor(type, data);
      assert.equal(validateEngineV2Document(document).ok, true, `${type} document validation`);
      for (const output of [serializeEngineV2Svg(document), serializeEngineV2PrintHtml(document), serializeEngineV2ReactTsx(document)]) {
        assert.match(output, new RegExp(`deterministic ${type}`), `${type} export identity`);
        assert.doesNotMatch(output, /No chart data/, `${type} export content`);
      }
    }
  });
});
