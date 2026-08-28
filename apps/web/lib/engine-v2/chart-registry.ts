export type ChartDataContract =
  | "cartesian"
  | "scatter"
  | "heatmap"
  | "candlestick"
  | "sankey"
  | "histogram"
  | "box-plot"
  | "bubble"
  | "combo"
  | "gantt";

export const CHART_RENDERER_KEYS = [
  "cartesian",
  "stacked-bar",
  "donut",
  "scatter",
  "radar",
  "heatmap",
  "treemap",
  "funnel",
  "gauge",
  "candlestick",
  "sankey",
  "waterfall",
  "histogram",
  "box-plot",
  "bubble",
  "combo",
  "stacked-area",
  "gantt",
] as const;

export type ChartRendererKey = typeof CHART_RENDERER_KEYS[number];

export type ChartFamilyDefinition = {
  dataContract: ChartDataContract;
  previewRenderer: ChartRendererKey;
  exportRenderer: ChartRendererKey;
  promptPatterns: readonly RegExp[];
  generationHint?: string;
  enforceContract?: true;
  contractError?: string;
  constraintError?: string;
  constraints?: {
    acyclic?: true;
    mixedDisplays?: true;
    minLabels?: number;
    minSeries?: number;
  };
};

export const CHART_FAMILY_REGISTRY = {
  sankey: { dataContract: "sankey", previewRenderer: "sankey", exportRenderer: "sankey", promptPatterns: [/\bsankey\s+(?:chart|diagram|graph)\b/], generationHint: "Sankey data uses acyclic positive flows [{source,target,value}].", enforceContract: true, contractError: "Sankey data must use source, target, and positive value", constraints: { acyclic: true } },
  waterfall: { dataContract: "cartesian", previewRenderer: "waterfall", exportRenderer: "waterfall", promptPatterns: [/\bwaterfall\s+(?:chart|graph)\b/], generationHint: "Waterfall data uses ordered changes [{label,value}].", enforceContract: true, contractError: "Waterfall data must use label and value" },
  histogram: { dataContract: "histogram", previewRenderer: "histogram", exportRenderer: "histogram", promptPatterns: [/\bhistogram\b/], generationHint: "Histogram data uses raw samples [{value}].", enforceContract: true, contractError: "Histogram data must use raw numeric values" },
  "box-plot": { dataContract: "box-plot", previewRenderer: "box-plot", exportRenderer: "box-plot", promptPatterns: [/\bbox(?:\s+and\s+whisker|\s*plot)\b/], generationHint: "Box plot data uses [{label,min,q1,median,q3,max}].", enforceContract: true, contractError: "Box plot data must use label, min, q1, median, q3, and max" },
  bubble: { dataContract: "bubble", previewRenderer: "bubble", exportRenderer: "bubble", promptPatterns: [/\bbubble\s+(?:chart|plot)\b/], generationHint: "Bubble data uses [{x,y,size,label?,series?}].", enforceContract: true, contractError: "Bubble data must use x, y, and positive size" },
  combo: { dataContract: "combo", previewRenderer: "combo", exportRenderer: "combo", promptPatterns: [/\b(?:combo|combination|dual[ -]axis)\s+(?:chart|graph)\b/], generationHint: "Combo data uses [{label,value,series,display:'bar'|'line',axis?:'left'|'right'}].", enforceContract: true, contractError: "Combo data must use label, value, and display", constraints: { mixedDisplays: true } },
  "stacked-area": { dataContract: "cartesian", previewRenderer: "stacked-area", exportRenderer: "stacked-area", promptPatterns: [/\bstacked\s+area\s+(?:chart|graph)\b/], generationHint: "Stacked-area uses multiple [{label,value,series}].", enforceContract: true, contractError: "Stacked area data must contain at least two labels and two series", constraintError: "Stacked area data must contain at least two labels and two series", constraints: { minLabels: 2, minSeries: 2 } },
  gantt: { dataContract: "gantt", previewRenderer: "gantt", exportRenderer: "gantt", promptPatterns: [/\b(?:gantt|timeline)\s+(?:chart|diagram)?\b/], generationHint: "Gantt uses [{label,start,end,series?}] with ISO dates.", enforceContract: true, contractError: "Gantt data must use label, ISO start, and ISO end" },
  donut: { dataContract: "cartesian", previewRenderer: "donut", exportRenderer: "donut", promptPatterns: [/\b(?:donut|doughnut|pie)\s+(?:chart|graph)\b/] },
  candlestick: { dataContract: "candlestick", previewRenderer: "candlestick", exportRenderer: "candlestick", promptPatterns: [/\bcandlestick\s+chart\b/], generationHint: "Candlestick data uses [{label,open,high,low,close}]." },
  heatmap: { dataContract: "heatmap", previewRenderer: "heatmap", exportRenderer: "heatmap", promptPatterns: [/\bheatmap\b|\bheat\s+map\b/], generationHint: "Heatmap data uses [{row,column,value}]." },
  treemap: { dataContract: "cartesian", previewRenderer: "treemap", exportRenderer: "treemap", promptPatterns: [/\btreemap\b|\btree\s+map\b/] },
  radar: { dataContract: "cartesian", previewRenderer: "radar", exportRenderer: "radar", promptPatterns: [/\bradar\s+chart\b|\bspider\s+chart\b/] },
  funnel: { dataContract: "cartesian", previewRenderer: "funnel", exportRenderer: "funnel", promptPatterns: [/\bfunnel\s+chart\b/] },
  gauge: { dataContract: "cartesian", previewRenderer: "gauge", exportRenderer: "gauge", promptPatterns: [/\bgauge\s+chart\b/] },
  scatter: { dataContract: "scatter", previewRenderer: "scatter", exportRenderer: "scatter", promptPatterns: [/\bscatter\s+(?:chart|plot|graph)\b/], generationHint: "Scatter data uses [{x,y,label?,series?}]." },
  "stacked-bar": { dataContract: "cartesian", previewRenderer: "stacked-bar", exportRenderer: "stacked-bar", promptPatterns: [/\bstacked\s+(?:bar|column)\s+chart\b/] },
  area: { dataContract: "cartesian", previewRenderer: "cartesian", exportRenderer: "cartesian", promptPatterns: [/\barea\s+chart\b/] },
  line: { dataContract: "cartesian", previewRenderer: "cartesian", exportRenderer: "cartesian", promptPatterns: [/\b(?:line|trend|time\s*series)\s+(?:chart|graph)\b|\bover\s+time\b/] },
  bar: { dataContract: "cartesian", previewRenderer: "cartesian", exportRenderer: "cartesian", promptPatterns: [/\b(?:bar|column)\s+(?:chart|graph)\b/] },
} as const satisfies Record<string, ChartFamilyDefinition>;

export type RegisteredChartType = keyof typeof CHART_FAMILY_REGISTRY;

export const CHART_FAMILY_TYPES = Object.keys(CHART_FAMILY_REGISTRY) as RegisteredChartType[];

export function chartFamilyDefinition(type: RegisteredChartType): ChartFamilyDefinition {
  return CHART_FAMILY_REGISTRY[type];
}

export function previewRendererForChart(type: RegisteredChartType): ChartRendererKey {
  return chartFamilyDefinition(type).previewRenderer;
}

export function exportRendererForChart(type: RegisteredChartType): ChartRendererKey {
  return chartFamilyDefinition(type).exportRenderer;
}
