import {
  isCartesianDatum,
  isCandlestickDatum,
  isHeatmapDatum,
  isHistogramDatum,
  isBoxPlotDatum,
  isBubbleDatum,
  isComboDatum,
  isGanttDatum,
  isSankeyDatum,
  isScatterDatum,
  type CandlestickChartDatum,
  type BoxPlotChartDatum,
  type BubbleChartDatum,
  type ComboChartDatum,
  type CartesianChartDatum,
  type DeterministicChartDatum,
  type HeatmapChartDatum,
  type HistogramChartDatum,
  type GanttChartDatum,
  type SankeyChartDatum,
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

export type TreemapRect = {
  label: string;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SankeyLayoutNode = {
  id: string;
  layer: number;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
  colorIndex: number;
};

export type SankeyLayoutLink = SankeyChartDatum & {
  width: number;
  path: string;
  colorIndex: number;
};

export type SankeyLayout = {
  nodes: SankeyLayoutNode[];
  links: SankeyLayoutLink[];
};

export type WaterfallStep = CartesianChartDatum & {
  start: number;
  end: number;
};

export type HistogramBin = {
  start: number;
  end: number;
  count: number;
};

export type StackedAreaLayer = {
  series: string;
  points: Array<{ label: string; start: number; end: number }>;
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

export function finiteHeatmapData(data: DeterministicChartDatum[]): HeatmapChartDatum[] {
  return data.filter((datum): datum is HeatmapChartDatum =>
    isHeatmapDatum(datum) && Number.isFinite(datum.value) && datum.row.trim().length > 0 && datum.column.trim().length > 0,
  );
}

export function finiteCandlestickData(data: DeterministicChartDatum[]): CandlestickChartDatum[] {
  return data.filter((datum): datum is CandlestickChartDatum =>
    isCandlestickDatum(datum)
      && datum.label.trim().length > 0
      && [datum.open, datum.high, datum.low, datum.close].every(Number.isFinite),
  ).map((datum) => ({
    ...datum,
    high: Math.max(datum.high, datum.open, datum.low, datum.close),
    low: Math.min(datum.low, datum.open, datum.high, datum.close),
  }));
}

export function finiteSankeyData(data: DeterministicChartDatum[]): SankeyChartDatum[] {
  return data.filter((datum): datum is SankeyChartDatum =>
    isSankeyDatum(datum)
      && Number.isFinite(datum.value)
      && datum.value > 0
      && datum.source.trim().length > 0
      && datum.target.trim().length > 0
      && datum.source !== datum.target,
  );
}

export function finiteHistogramData(data: DeterministicChartDatum[]): HistogramChartDatum[] {
  return data.filter((datum): datum is HistogramChartDatum => isHistogramDatum(datum) && Number.isFinite(datum.value));
}

export function finiteBoxPlotData(data: DeterministicChartDatum[]): BoxPlotChartDatum[] {
  return data.filter((datum): datum is BoxPlotChartDatum =>
    isBoxPlotDatum(datum)
      && datum.label.trim().length > 0
      && [datum.min, datum.q1, datum.median, datum.q3, datum.max].every(Number.isFinite)
      && datum.min <= datum.q1
      && datum.q1 <= datum.median
      && datum.median <= datum.q3
      && datum.q3 <= datum.max,
  );
}

export function finiteBubbleData(data: DeterministicChartDatum[]): BubbleChartDatum[] {
  return data.filter((datum): datum is BubbleChartDatum =>
    isBubbleDatum(datum) && Number.isFinite(datum.x) && Number.isFinite(datum.y) && Number.isFinite(datum.size) && datum.size > 0,
  );
}

export function finiteComboData(data: DeterministicChartDatum[]): ComboChartDatum[] {
  return data.filter((datum): datum is ComboChartDatum =>
    isComboDatum(datum) && datum.label.trim().length > 0 && Number.isFinite(datum.value),
  );
}

export function finiteGanttData(data: DeterministicChartDatum[]): GanttChartDatum[] {
  return data.filter((datum): datum is GanttChartDatum => {
    if (!isGanttDatum(datum) || !datum.label.trim()) return false;
    const start = Date.parse(datum.start);
    const end = Date.parse(datum.end);
    return Number.isFinite(start) && Number.isFinite(end) && end >= start;
  });
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

export function polarPoint(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

export function interpolateHexColor(start: string, end: string, ratio: number): string {
  const parse = (color: string) => {
    const normalized = color.replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
    return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
  };
  const from = parse(start);
  const to = parse(end);
  if (!from || !to) return end;
  const bounded = Math.min(Math.max(ratio, 0), 1);
  return `#${from.map((channel, index) => Math.round(channel + (to[index] - channel) * bounded).toString(16).padStart(2, "0")).join("")}`;
}

export function layoutTreemap(
  data: CartesianChartDatum[],
  width: number,
  height: number,
): TreemapRect[] {
  const items = data
    .filter((datum) => datum.value > 0)
    .map((datum) => ({ label: datum.label, value: datum.value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const rectangles: TreemapRect[] = [];

  const place = (subset: typeof items, x: number, y: number, boxWidth: number, boxHeight: number) => {
    if (subset.length === 0) return;
    if (subset.length === 1) {
      rectangles.push({ ...subset[0], x, y, width: boxWidth, height: boxHeight });
      return;
    }
    const total = subset.reduce((sum, item) => sum + item.value, 0);
    let splitIndex = 1;
    let firstTotal = subset[0].value;
    while (splitIndex < subset.length - 1 && firstTotal + subset[splitIndex].value <= total / 2) {
      firstTotal += subset[splitIndex].value;
      splitIndex += 1;
    }
    const ratio = firstTotal / total;
    if (boxWidth >= boxHeight) {
      const firstWidth = boxWidth * ratio;
      place(subset.slice(0, splitIndex), x, y, firstWidth, boxHeight);
      place(subset.slice(splitIndex), x + firstWidth, y, boxWidth - firstWidth, boxHeight);
    } else {
      const firstHeight = boxHeight * ratio;
      place(subset.slice(0, splitIndex), x, y, boxWidth, firstHeight);
      place(subset.slice(splitIndex), x, y + firstHeight, boxWidth, boxHeight - firstHeight);
    }
  };

  place(items, 0, 0, Math.max(width, 0), Math.max(height, 0));
  return rectangles;
}

function aggregateSankeyLinks(data: SankeyChartDatum[]): SankeyChartDatum[] {
  const links = new Map<string, SankeyChartDatum>();
  for (const datum of data) {
    const key = `${datum.source}\u0000${datum.target}`;
    const current = links.get(key);
    links.set(key, { ...datum, value: (current?.value ?? 0) + datum.value });
  }
  return [...links.values()];
}

export function hasSankeyCycle(data: SankeyChartDatum[]): boolean {
  const links = aggregateSankeyLinks(data);
  const ids = orderedUnique(links.flatMap((link) => [link.source, link.target]));
  const indegree = new Map(ids.map((id) => [id, 0]));
  const outgoing = new Map(ids.map((id) => [id, [] as string[]]));
  for (const link of links) {
    indegree.set(link.target, (indegree.get(link.target) ?? 0) + 1);
    outgoing.get(link.source)?.push(link.target);
  }
  const queue = ids.filter((id) => indegree.get(id) === 0);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift()!;
    visited += 1;
    for (const target of outgoing.get(id) ?? []) {
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) queue.push(target);
    }
  }
  return visited !== ids.length;
}

export function layoutSankey(
  rawData: SankeyChartDatum[],
  width: number,
  height: number,
): SankeyLayout | null {
  const data = aggregateSankeyLinks(rawData.filter((datum) => datum.value > 0 && datum.source !== datum.target));
  if (!data.length || hasSankeyCycle(data) || width <= 0 || height <= 0) return null;
  const ids = orderedUnique(data.flatMap((link) => [link.source, link.target]));
  const incoming = new Map(ids.map((id) => [id, [] as SankeyChartDatum[]]));
  const outgoing = new Map(ids.map((id) => [id, [] as SankeyChartDatum[]]));
  const indegree = new Map(ids.map((id) => [id, 0]));
  for (const link of data) {
    incoming.get(link.target)?.push(link);
    outgoing.get(link.source)?.push(link);
    indegree.set(link.target, (indegree.get(link.target) ?? 0) + 1);
  }

  const layers = new Map(ids.map((id) => [id, 0]));
  const queue = ids.filter((id) => indegree.get(id) === 0);
  while (queue.length) {
    const id = queue.shift()!;
    for (const link of outgoing.get(id) ?? []) {
      layers.set(link.target, Math.max(layers.get(link.target) ?? 0, (layers.get(id) ?? 0) + 1));
      const next = (indegree.get(link.target) ?? 0) - 1;
      indegree.set(link.target, next);
      if (next === 0) queue.push(link.target);
    }
  }
  const maxLayer = Math.max(...layers.values(), 1);
  for (const id of ids) if ((outgoing.get(id)?.length ?? 0) === 0) layers.set(id, maxLayer);
  const nodeWidth = Math.min(18, width / Math.max(maxLayer * 5, 1));
  const layerGap = 10;
  const idsByLayer = Array.from({ length: maxLayer + 1 }, (_, layer) => ids.filter((id) => layers.get(id) === layer));
  const nodeValue = (id: string) => Math.max(
    (incoming.get(id) ?? []).reduce((sum, link) => sum + link.value, 0),
    (outgoing.get(id) ?? []).reduce((sum, link) => sum + link.value, 0),
  );
  const scale = Math.min(...idsByLayer.filter((layer) => layer.length).map((layer) => {
    const available = Math.max(height - layerGap * (layer.length - 1), 1);
    return available / layer.reduce((sum, id) => sum + nodeValue(id), 0);
  }));
  const nodes: SankeyLayoutNode[] = [];
  idsByLayer.forEach((layerIds, layer) => {
    const used = layerIds.reduce((sum, id) => sum + nodeValue(id) * scale, 0) + Math.max(layerIds.length - 1, 0) * layerGap;
    let y = Math.max((height - used) / 2, 0);
    for (const id of layerIds) {
      const nodeHeight = Math.max(nodeValue(id) * scale, 1);
      nodes.push({ id, layer, value: nodeValue(id), x: (width - nodeWidth) * layer / maxLayer, y, width: nodeWidth, height: nodeHeight, colorIndex: ids.indexOf(id) });
      y += nodeHeight + layerGap;
    }
  });

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const sourceOffsets = new Map(ids.map((id) => [id, 0]));
  const targetOffsets = new Map(ids.map((id) => [id, 0]));
  const links: SankeyLayoutLink[] = data.map((link) => {
    const source = nodeById.get(link.source)!;
    const target = nodeById.get(link.target)!;
    const linkWidth = Math.max(link.value * scale, 1);
    const sourceY = source.y + (sourceOffsets.get(link.source) ?? 0) + linkWidth / 2;
    const targetY = target.y + (targetOffsets.get(link.target) ?? 0) + linkWidth / 2;
    sourceOffsets.set(link.source, (sourceOffsets.get(link.source) ?? 0) + linkWidth);
    targetOffsets.set(link.target, (targetOffsets.get(link.target) ?? 0) + linkWidth);
    const sourceX = source.x + source.width;
    const targetX = target.x;
    const control = (targetX - sourceX) * 0.48;
    return {
      ...link,
      width: linkWidth,
      path: `M${sourceX},${sourceY} C${sourceX + control},${sourceY} ${targetX - control},${targetY} ${targetX},${targetY}`,
      colorIndex: source.colorIndex,
    };
  });
  return { nodes, links };
}

export function layoutWaterfall(data: CartesianChartDatum[]): { steps: WaterfallStep[]; domain: NumericDomain } {
  let cumulative = 0;
  const steps = data.map((datum) => {
    const start = cumulative;
    cumulative += datum.value;
    return { ...datum, start, end: cumulative };
  });
  return { steps, domain: numericDomain([0, ...steps.flatMap((step) => [step.start, step.end])], { includeZero: true }) };
}

export function binHistogram(data: HistogramChartDatum[], requestedBins?: number): { bins: HistogramBin[]; domain: NumericDomain } {
  const values = data.map((datum) => datum.value).filter(Number.isFinite);
  const domain = numericDomain(values);
  if (!values.length) return { bins: [], domain };
  const binCount = Math.min(Math.max(Math.round(requestedBins ?? Math.sqrt(values.length)), 1), 40);
  const span = domain.max - domain.min || 1;
  const binWidth = span / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    start: domain.min + index * binWidth,
    end: domain.min + (index + 1) * binWidth,
    count: 0,
  }));
  for (const value of values) {
    const index = Math.min(Math.floor((value - domain.min) / binWidth), binCount - 1);
    bins[Math.max(index, 0)].count += 1;
  }
  return { bins, domain };
}

export function stackAreaData(data: CartesianChartDatum[]): { labels: string[]; layers: StackedAreaLayer[]; domain: NumericDomain } {
  const labels = orderedUnique(data.map((datum) => datum.label));
  const series = orderedUnique(data.map((datum) => datum.series?.trim() || "Value"));
  const values = new Map<string, number>();
  for (const datum of data) {
    const seriesName = datum.series?.trim() || "Value";
    const key = `${datum.label}\u0000${seriesName}`;
    values.set(key, (values.get(key) ?? 0) + datum.value);
  }
  const positive = new Map(labels.map((label) => [label, 0]));
  const negative = new Map(labels.map((label) => [label, 0]));
  const domainValues = [0];
  const layers = series.map((seriesName) => ({
    series: seriesName,
    points: labels.map((label) => {
      const value = values.get(`${label}\u0000${seriesName}`) ?? 0;
      const start = value >= 0 ? positive.get(label) ?? 0 : negative.get(label) ?? 0;
      const end = start + value;
      if (value >= 0) positive.set(label, end);
      else negative.set(label, end);
      domainValues.push(start, end);
      return { label, start, end };
    }),
  }));
  return { labels, layers, domain: numericDomain(domainValues, { includeZero: true }) };
}

export function bandAreaPath(upper: Array<{ x: number; y: number }>, lower: Array<{ x: number; y: number }>): string {
  if (!upper.length || upper.length !== lower.length) return "";
  const top = upper.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const bottom = [...lower].reverse().map((point) => `L${point.x},${point.y}`).join(" ");
  return `${top} ${bottom} Z`;
}
