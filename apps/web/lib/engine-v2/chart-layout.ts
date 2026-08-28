import {
  isCartesianDatum,
  isScatterDatum,
  type CartesianChartDatum,
  type DeterministicChartDatum,
  type ScatterChartDatum,
} from "./chart-types.ts";

export type NumericDomain = {
  min: number;
  max: number;
  ticks: number[];
};

export type StackedSegment = {
  label: string;
  series: string;
  value: number;
  start: number;
  end: number;
};

export function finiteCartesianData(data: DeterministicChartDatum[]): CartesianChartDatum[] {
  return data.filter((datum): datum is CartesianChartDatum =>
    isCartesianDatum(datum) && Number.isFinite(datum.value) && datum.label.trim().length > 0,
  );
}

export function finiteScatterData(data: DeterministicChartDatum[]): ScatterChartDatum[] {
  return data.filter((datum): datum is ScatterChartDatum =>
    isScatterDatum(datum) && Number.isFinite(datum.x) && Number.isFinite(datum.y),
  );
}

function niceStep(span: number, targetTicks: number): number {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const rough = span / Math.max(targetTicks, 1);
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * power;
}

export function numericDomain(
  values: number[],
  options: { includeZero?: boolean; targetTicks?: number } = {},
): NumericDomain {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return { min: 0, max: 1, ticks: [0, 1] };

  let rawMin = Math.min(...finite);
  let rawMax = Math.max(...finite);
  if (options.includeZero) {
    rawMin = Math.min(rawMin, 0);
    rawMax = Math.max(rawMax, 0);
  }
  if (rawMin === rawMax) {
    const pad = Math.abs(rawMin) > 0 ? Math.abs(rawMin) * 0.2 : 1;
    rawMin -= pad;
    rawMax += pad;
    if (options.includeZero) rawMin = Math.min(rawMin, 0);
  }

  const step = niceStep(rawMax - rawMin, options.targetTicks ?? 4);
  const min = Math.floor(rawMin / step) * step;
  const max = Math.ceil(rawMax / step) * step;
  const ticks: number[] = [];
  const tickLimit = 100;
  for (let value = min, index = 0; value <= max + step * 0.001 && index < tickLimit; value += step, index += 1) {
    ticks.push(Number(value.toPrecision(12)));
  }
  return { min, max: max === min ? min + 1 : max, ticks };
}

export function scaleLinear(value: number, domain: NumericDomain, start: number, end: number): number {
  const ratio = (value - domain.min) / (domain.max - domain.min || 1);
  return start + ratio * (end - start);
}

export function orderedUnique(values: string[]): string[] {
  return [...new Set(values)];
}

export function stackCartesianData(data: CartesianChartDatum[]): {
  labels: string[];
  series: string[];
  segments: StackedSegment[];
  domain: NumericDomain;
} {
  const labels = orderedUnique(data.map((datum) => datum.label));
  const series = orderedUnique(data.map((datum) => datum.series?.trim() || "Value"));
  const byCell = new Map<string, number>();
  for (const datum of data) {
    const seriesName = datum.series?.trim() || "Value";
    const key = `${datum.label}\u0000${seriesName}`;
    byCell.set(key, (byCell.get(key) ?? 0) + datum.value);
  }

  const segments: StackedSegment[] = [];
  const totals: number[] = [0];
  for (const label of labels) {
    let positive = 0;
    let negative = 0;
    for (const seriesName of series) {
      const value = byCell.get(`${label}\u0000${seriesName}`) ?? 0;
      const start = value >= 0 ? positive : negative;
      const end = start + value;
      if (value >= 0) positive = end;
      else negative = end;
      segments.push({ label, series: seriesName, value, start, end });
    }
    totals.push(positive, negative);
  }

  return { labels, series, segments, domain: numericDomain(totals, { includeZero: true }) };
}

export function formatChartValue(value: number, prefix = "", suffix = ""): string {
  const absolute = Math.abs(value);
  const formatted = absolute >= 1_000_000
    ? `${trimDecimal(value / 1_000_000)}M`
    : absolute >= 1_000
      ? `${trimDecimal(value / 1_000)}K`
      : trimDecimal(value);
  return `${prefix}${formatted}${suffix}`;
}

function trimDecimal(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(value) < 10 && !Number.isInteger(value) ? 2 : 1,
  }).format(value);
}

export function linePath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
}

export function areaPath(points: Array<{ x: number; y: number }>, baseline: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const top = points.map((point) => `L${point.x},${point.y}`).join(" ");
  return `M${first.x},${baseline} ${top} L${last.x},${baseline} Z`;
}
