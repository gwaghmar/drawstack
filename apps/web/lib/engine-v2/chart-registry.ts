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
  | "gantt"
  | "hierarchy"
  | "symbol-map"
  | "route-map"
  | "error-bar";

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
  "sunburst",
  "icicle",
  "circle-pack",
  "chord",
  "geographic",
  "streamgraph",
  "error-bar",
  "density",
  "violin",
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
    nonnegative?: true;
  };
};

export const CHART_FAMILY_REGISTRY = {
  streamgraph: { dataContract: "cartesian", previewRenderer: "streamgraph", exportRenderer: "streamgraph", promptPatterns: [/\bstream\s*graph\b/], generationHint: "Streamgraph data uses nonnegative series values [{label,value,series}] across at least two labels and series.", enforceContract: true, contractError: "Streamgraph data must use label, nonnegative value, and series", constraintError: "Streamgraph data must contain at least two labels and two series with nonnegative values", constraints: { minLabels: 2, minSeries: 2, nonnegative: true } },
  "error-bar": { dataContract: "error-bar", previewRenderer: "error-bar", exportRenderer: "error-bar", promptPatterns: [/\berror[ -]bar\s+(?:chart|plot)?\b/], generationHint: "Error-bar data uses explicit bounds [{label,value,errorLow,errorHigh,series?}] where errorLow <= value <= errorHigh.", enforceContract: true, contractError: "Error bar data must use label, value, errorLow, and errorHigh with ordered bounds" },
  density: { dataContract: "histogram", previewRenderer: "density", exportRenderer: "density", promptPatterns: [/\bdensity\s+(?:chart|plot|curve)\b|\bkernel\s+density\b/], generationHint: "Density data uses raw samples [{value,series?}].", enforceContract: true, contractError: "Density data must use raw numeric values" },
  violin: { dataContract: "histogram", previewRenderer: "violin", exportRenderer: "violin", promptPatterns: [/\bviolin\s+(?:chart|plot)\b/], generationHint: "Violin data uses raw samples [{value,series?}].", enforceContract: true, contractError: "Violin data must use raw numeric values" },
  "symbol-map": { dataContract: "symbol-map", previewRenderer: "geographic", exportRenderer: "geographic", promptPatterns: [/\b(?:symbol|point|location)\s+map\b/], generationHint: "Symbol-map data uses real coordinates [{label,latitude,longitude,value?,series?}]. It renders a coordinate grid without geographic boundaries.", enforceContract: true, contractError: "Symbol map data must use label, latitude from -90 to 90, and longitude from -180 to 180" },
  "route-map": { dataContract: "route-map", previewRenderer: "geographic", exportRenderer: "geographic", promptPatterns: [/\b(?:route|flight|shipping|network)\s+map\b/], generationHint: "Route-map data uses real coordinates [{label,sourceLatitude,sourceLongitude,targetLatitude,targetLongitude,value?,series?}]. It renders a coordinate grid without geographic boundaries.", enforceContract: true, contractError: "Route map data must use label and valid source and target coordinates" },
  sunburst: { dataContract: "hierarchy", previewRenderer: "sunburst", exportRenderer: "sunburst", promptPatterns: [/\bsunburst\s+(?:chart|diagram)?\b/], generationHint: "Sunburst data uses positive leaf paths [{path:'Root/Branch/Leaf',value}].", enforceContract: true, contractError: "Sunburst data must use path and positive value" },
  icicle: { dataContract: "hierarchy", previewRenderer: "icicle", exportRenderer: "icicle", promptPatterns: [/\bicicle\s+(?:chart|diagram)?\b/], generationHint: "Icicle data uses positive leaf paths [{path:'Root/Branch/Leaf',value}].", enforceContract: true, contractError: "Icicle data must use path and positive value" },
  "circle-pack": { dataContract: "hierarchy", previewRenderer: "circle-pack", exportRenderer: "circle-pack", promptPatterns: [/\bcircle[ -]pack(?:ing)?\s+(?:chart|diagram)?\b/], generationHint: "Circle-pack data uses positive leaf paths [{path:'Root/Branch/Leaf',value}].", enforceContract: true, contractError: "Circle-pack data must use path and positive value" },
  chord: { dataContract: "sankey", previewRenderer: "chord", exportRenderer: "chord", promptPatterns: [/\bchord\s+(?:chart|diagram)?\b/], generationHint: "Chord data uses directed positive relationships [{source,target,value}].", enforceContract: true, contractError: "Chord data must use source, target, and positive value" },
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
