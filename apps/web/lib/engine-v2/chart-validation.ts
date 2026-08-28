import { chartFamilyDefinition, type RegisteredChartType } from "./chart-registry.ts";
import { hasSankeyCycle } from "./chart-layout.ts";
import { isRouteMapDatum, isSymbolMapDatum } from "./geographic-chart.ts";
import {
  isBoxPlotDatum,
  isBubbleDatum,
  isCandlestickDatum,
  isCartesianDatum,
  isComboDatum,
  isGanttDatum,
  isHeatmapDatum,
  isHistogramDatum,
  isHierarchyDatum,
  isSankeyDatum,
  isScatterDatum,
  type DeterministicChartDatum,
} from "./chart-types.ts";

const CONTRACT_LABELS = {
  cartesian: "label and value",
  scatter: "x and y",
  heatmap: "row, column, and value",
  candlestick: "label, open, high, low, and close",
  sankey: "source, target, and positive value",
  histogram: "raw numeric value",
  "box-plot": "label, min, q1, median, q3, and max",
  bubble: "x, y, and positive size",
  combo: "label, value, and display",
  gantt: "label, ISO start, and ISO end",
  hierarchy: "path and positive value",
  "symbol-map": "label, valid latitude, and valid longitude",
  "route-map": "label and valid source and target coordinates",
} as const;

const CONTRACT_VALIDATORS = {
  cartesian: (datum: DeterministicChartDatum) => isCartesianDatum(datum),
  scatter: (datum: DeterministicChartDatum) => isScatterDatum(datum),
  heatmap: (datum: DeterministicChartDatum) => isHeatmapDatum(datum),
  candlestick: (datum: DeterministicChartDatum) => isCandlestickDatum(datum),
  sankey: (datum: DeterministicChartDatum) => isSankeyDatum(datum),
  histogram: (datum: DeterministicChartDatum) => isHistogramDatum(datum),
  "box-plot": (datum: DeterministicChartDatum) => isBoxPlotDatum(datum),
  bubble: (datum: DeterministicChartDatum) => isBubbleDatum(datum),
  combo: (datum: DeterministicChartDatum) => isComboDatum(datum),
  gantt: (datum: DeterministicChartDatum) => isGanttDatum(datum),
  hierarchy: (datum: DeterministicChartDatum) => isHierarchyDatum(datum),
  "symbol-map": (datum: DeterministicChartDatum) => isSymbolMapDatum(datum),
  "route-map": (datum: DeterministicChartDatum) => isRouteMapDatum(datum),
} as const;

function familyLabel(type: RegisteredChartType): string {
  return `${type[0].toUpperCase()}${type.slice(1)}`;
}

export function validateChartFamilyData(type: RegisteredChartType, data: DeterministicChartDatum[]): string[] {
  const definition = chartFamilyDefinition(type);
  if (!definition.enforceContract) return [];
  const matches = CONTRACT_VALIDATORS[definition.dataContract];
  if (!data.every(matches)) return [definition.contractError ?? `${familyLabel(type)} data must use ${CONTRACT_LABELS[definition.dataContract]}`];

  const issues: string[] = [];
  if (definition.constraints?.acyclic && data.every(isSankeyDatum) && hasSankeyCycle(data)) issues.push(`${familyLabel(type)} data must be acyclic`);
  if (definition.constraints?.mixedDisplays && data.every(isComboDatum)) {
    const metadata = new Map<string, string>();
    for (const datum of data) {
      const seriesName = datum.series?.trim() || "Value";
      const signature = `${datum.display}:${datum.axis ?? "left"}`;
      const previous = metadata.get(seriesName);
      if (previous && previous !== signature) issues.push("Each combo series must keep one display and axis");
      metadata.set(seriesName, signature);
    }
    if (!data.some((datum) => datum.display === "bar") || !data.some((datum) => datum.display === "line")) issues.push("Combo charts require both bar and line series");
  }
  if (definition.constraints?.minLabels && data.every(isCartesianDatum) && new Set(data.map((datum) => datum.label)).size < definition.constraints.minLabels) issues.push(definition.constraintError ?? `${type} data needs at least ${definition.constraints.minLabels} labels`);
  if (definition.constraints?.minSeries && data.every(isCartesianDatum) && new Set(data.map((datum) => datum.series?.trim() || "Value")).size < definition.constraints.minSeries) issues.push(definition.constraintError ?? `${type} data needs at least ${definition.constraints.minSeries} series`);
  return [...new Set(issues)];
}
