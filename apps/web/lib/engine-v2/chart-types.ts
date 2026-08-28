import type { RegisteredChartType } from "./chart-registry";

export type DeterministicChartType = RegisteredChartType;

export type CartesianChartDatum = {
  label: string;
  value: number;
  series?: string;
};

export type ScatterChartDatum = {
  label?: string;
  x: number;
  y: number;
  series?: string;
};

export type HeatmapChartDatum = {
  row: string;
  column: string;
  value: number;
};

export type CandlestickChartDatum = {
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type SankeyChartDatum = {
  source: string;
  target: string;
  value: number;
};

export type HistogramChartDatum = {
  value: number;
};

export type BoxPlotChartDatum = {
  label: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  series?: string;
};

export type BubbleChartDatum = ScatterChartDatum & {
  size: number;
};

export type ComboChartDatum = CartesianChartDatum & {
  display: "bar" | "line";
  axis?: "left" | "right";
};

export type GanttChartDatum = {
  label: string;
  start: string;
  end: string;
  series?: string;
};

export type DeterministicChartDatum =
  | CartesianChartDatum
  | ScatterChartDatum
  | HeatmapChartDatum
  | CandlestickChartDatum
  | SankeyChartDatum
  | HistogramChartDatum
  | BoxPlotChartDatum
  | BubbleChartDatum
  | ComboChartDatum
  | GanttChartDatum;

export type DeterministicChartPalette = {
  foreground: string;
  muted: string;
  grid: string;
  surface: string;
  series: string[];
};

export type DeterministicChartSpec = {
  type: DeterministicChartType;
  title: string;
  data: DeterministicChartDatum[];
  valuePrefix?: string;
  valueSuffix?: string;
  xLabel?: string;
  yLabel?: string;
  showLegend?: boolean;
  showValues?: boolean;
  minValue?: number;
  maxValue?: number;
  targetValue?: number;
  palette?: Partial<DeterministicChartPalette>;
  emptyMessage?: string;
};

export const DEFAULT_CHART_PALETTE: DeterministicChartPalette = {
  foreground: "#15171A",
  muted: "#667067",
  grid: "#D7DBD2",
  surface: "#FFFFFF",
  series: ["#3157F6", "#FF5D2E", "#1D8A6A", "#8755D9", "#D7A012", "#2676A8"],
};

export function isScatterDatum(datum: DeterministicChartDatum): datum is ScatterChartDatum {
  return "x" in datum && "y" in datum;
}

export function isCartesianDatum(datum: DeterministicChartDatum): datum is CartesianChartDatum {
  return "value" in datum && "label" in datum;
}

export function isHeatmapDatum(datum: DeterministicChartDatum): datum is HeatmapChartDatum {
  return "row" in datum && "column" in datum && "value" in datum;
}

export function isCandlestickDatum(datum: DeterministicChartDatum): datum is CandlestickChartDatum {
  return "open" in datum && "high" in datum && "low" in datum && "close" in datum && "label" in datum;
}

export function isSankeyDatum(datum: DeterministicChartDatum): datum is SankeyChartDatum {
  return "source" in datum && "target" in datum && "value" in datum;
}

export function isHistogramDatum(datum: DeterministicChartDatum): datum is HistogramChartDatum {
  return "value" in datum && !("label" in datum) && !("source" in datum) && !("row" in datum);
}

export function isBoxPlotDatum(datum: DeterministicChartDatum): datum is BoxPlotChartDatum {
  return "min" in datum && "q1" in datum && "median" in datum && "q3" in datum && "max" in datum && "label" in datum;
}

export function isBubbleDatum(datum: DeterministicChartDatum): datum is BubbleChartDatum {
  return "x" in datum && "y" in datum && "size" in datum;
}

export function isComboDatum(datum: DeterministicChartDatum): datum is ComboChartDatum {
  return "label" in datum && "value" in datum && "display" in datum;
}

export function isGanttDatum(datum: DeterministicChartDatum): datum is GanttChartDatum {
  return "label" in datum && "start" in datum && "end" in datum;
}
