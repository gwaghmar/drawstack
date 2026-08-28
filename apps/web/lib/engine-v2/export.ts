import {
  areaPath,
  bandAreaPath,
  finiteCandlestickData,
  finiteBoxPlotData,
  finiteBubbleData,
  finiteComboData,
  finiteCartesianData,
  finiteHeatmapData,
  finiteHistogramData,
  finiteGanttData,
  finiteSankeyData,
  finiteScatterData,
  formatChartValue,
  binHistogram,
  interpolateHexColor,
  layoutTreemap,
  layoutSankey,
  layoutWaterfall,
  linePath,
  numericDomain,
  orderedUnique,
  polarPoint,
  scaleLinear,
  stackCartesianData,
  stackAreaData,
} from "./chart-layout.ts";
import type { DeterministicChartType } from "./chart-types.ts";
import { geographicChartSvg } from "./geographic-chart.ts";
import { CHART_FAMILY_TYPES, exportRendererForChart, type ChartRendererKey } from "./chart-registry.ts";
import type {
  EngineChartNode,
  EngineDocument,
  EngineFrameNode,
  EngineGraphNode,
  EngineNode,
  EngineStyle,
  EngineTokens,
} from "./document.ts";
import { layoutGraph } from "./graph/layout.ts";
import type { LayoutGraphNode } from "./graph/types.ts";
import { annularSectorPath, chordGeometry, layoutHierarchy } from "./hierarchy-layout.ts";
import { densitySeries, finiteErrorBarData, streamLayers } from "./distribution-layout.ts";

export type EngineV2ExportPayload = {
  filename: string;
  mimeType: string;
  contents: string;
};

const CHART = { width: 640, height: 330, left: 62, top: 24, right: 616, bottom: 270 };
const FALLBACK_COLORS = {
  ink: "#15171A",
  paper: "#F7F8F4",
  panel: "#FFFFFF",
  rule: "#D7DBD2",
  cobalt: "#3157F6",
  orange: "#FF5D2E",
  quiet: "#667067",
  positive: "#1D8C65",
};
const SERIES_COLORS = ["#3157F6", "#FF5D2E", "#1D8A6A", "#8755D9", "#D7A012", "#2676A8"];

const EXPORT_CSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.engine-artboard{width:100%;min-height:100%;overflow:hidden}
.engine-frame{min-width:0}
.engine-text-eyebrow{font:600 11px/1.3 ui-monospace,SFMono-Regular,monospace;letter-spacing:.18em;text-transform:uppercase}
.engine-text-display{max-width:720px;font-size:58px;font-weight:650;line-height:.94;letter-spacing:-.055em}
.engine-text-heading{font-size:24px;font-weight:650;line-height:1.15;letter-spacing:-.03em}
.engine-text-body{font-size:15px;line-height:1.6}
.engine-text-caption{font:400 11px/1.4 ui-monospace,SFMono-Regular,monospace;letter-spacing:.04em}
.engine-card{min-width:0;padding:20px;border:1px solid var(--rule);border-radius:14px;background:var(--panel);break-inside:avoid}
.engine-metric-label{font:600 10px/1.3 ui-monospace,SFMono-Regular,monospace;letter-spacing:.13em;text-transform:uppercase;color:var(--quiet)}
.engine-metric-value{margin-top:12px;font-size:32px;font-weight:650;line-height:1;letter-spacing:-.045em}
.engine-metric-detail{margin-top:12px;font-size:12px;color:var(--quiet)}
.engine-card-header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}
.engine-card-title{margin:0;font-size:15px;font-weight:650;letter-spacing:-.02em}
.engine-badge{padding:4px 10px;border-radius:999px;background:#F0F2EC;color:var(--quiet);font:600 9px/1.2 ui-monospace,SFMono-Regular,monospace;letter-spacing:.08em;text-transform:uppercase}
.engine-chart{display:block;width:100%;height:auto;overflow:visible}
.engine-chart text,.engine-graph text{font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.engine-graph{display:block;width:100%;height:auto;background:var(--paper)}
@media(max-width:700px){.engine-frame[data-direction="row"]{flex-direction:column!important}.engine-frame[data-layout="grid"]{grid-template-columns:1fr!important}.engine-text-display{font-size:40px}}
`;

function escapeMarkup(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function number(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function color(tokens: EngineTokens, key: keyof typeof FALLBACK_COLORS): string {
  return tokens.colors[key] ?? FALLBACK_COLORS[key];
}

function resolveColor(value: string | undefined, tokens: EngineTokens): string | undefined {
  if (!value) return undefined;
  return value.startsWith("$") ? tokens.colors[value.slice(1)] : value;
}

function cssValue(value: string): string {
  return value.replace(/[<>"'`;{}]/g, "");
}

function styleCss(style: EngineStyle | undefined, tokens: EngineTokens): string {
  if (!style) return "";
  const declarations: string[] = [];
  const addColor = (property: string, value: string | undefined) => {
    const resolved = resolveColor(value, tokens);
    if (resolved) declarations.push(`${property}:${cssValue(resolved)}`);
  };
  addColor("background", style.background);
  addColor("color", style.color);
  addColor("border-color", style.borderColor);
  if (Number.isFinite(style.borderWidth)) declarations.push(`border-width:${number(style.borderWidth!)}px`, "border-style:solid");
  if (Number.isFinite(style.borderRadius)) declarations.push(`border-radius:${number(style.borderRadius!)}px`);
  if (Number.isFinite(style.minHeight)) declarations.push(`min-height:${number(style.minHeight!)}px`);
  if (typeof style.width === "number" && Number.isFinite(style.width)) declarations.push(`width:${number(style.width)}px`);
  if (typeof style.width === "string" && /^(?:100|[1-9]?\d)%$/.test(style.width)) declarations.push(`width:${style.width}`);
  if (Number.isFinite(style.flex)) declarations.push(`flex:${number(style.flex!)}`);
  if (style.alignSelf) declarations.push(`align-self:${cssValue(style.alignSelf)}`);
  return declarations.join(";");
}

function frameStyle(node: EngineFrameNode, tokens: EngineTokens): string {
  const layout = node.layout;
  const values = layout.mode === "grid"
    ? [`display:grid`, `grid-template-columns:repeat(${layout.columns ?? 1},minmax(0,1fr))`]
    : [`display:flex`, `flex-direction:${layout.direction ?? "row"}`];
  values.push(`gap:${number(layout.gap)}px`, `padding:${number(layout.padding)}px`);
  if (layout.align) values.push(`align-items:${cssValue(layout.align)}`);
  if (layout.justify) values.push(`justify-content:${cssValue(layout.justify)}`);
  const extra = styleCss(node.style, tokens);
  if (extra) values.push(extra);
  return values.join(";");
}

function chartGrid(domain: ReturnType<typeof numericDomain>, node: EngineChartNode, tokens: EngineTokens): string {
  return domain.ticks.map((tick) => {
    const y = scaleLinear(tick, domain, CHART.bottom, CHART.top);
    return `<line x1="${CHART.left}" y1="${number(y)}" x2="${CHART.right}" y2="${number(y)}" stroke="${escapeMarkup(color(tokens, "rule"))}"/><text x="${CHART.left - 10}" y="${number(y + 4)}" text-anchor="end" font-size="11" fill="${escapeMarkup(color(tokens, "quiet"))}">${escapeMarkup(formatChartValue(tick, node.valuePrefix, node.valueSuffix))}</text>`;
  }).join("");
}

function categoryLabels(labels: string[], tokens: EngineTokens): string {
  const band = (CHART.right - CHART.left) / Math.max(labels.length, 1);
  const limit = Math.max(5, Math.floor(64 / Math.max(labels.length, 1)));
  return labels.map((label, index) => {
    const truncated = label.length <= limit ? label : `${label.slice(0, Math.max(limit - 1, 1))}…`;
    return `<text x="${number(CHART.left + band * (index + 0.5))}" y="${CHART.bottom + 21}" text-anchor="middle" font-size="11" fill="${escapeMarkup(color(tokens, "quiet"))}">${escapeMarkup(truncated)}</text>`;
  }).join("");
}

function arcPath(cx: number, cy: number, radius: number, start: number, end: number): string {
  const first = polarPoint(cx, cy, radius, start);
  const last = polarPoint(cx, cy, radius, end);
  return `M${number(first.x)},${number(first.y)} A${radius},${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${number(last.x)},${number(last.y)}`;
}

function advancedChartSvg(node: EngineChartNode, tokens: EngineTokens, open: string, renderer: ChartRendererKey): string | null {
  const foreground = escapeMarkup(color(tokens, "ink"));
  const muted = escapeMarkup(color(tokens, "quiet"));
  const surface = color(tokens, "panel");
  const grid = escapeMarkup(color(tokens, "rule"));
  if (renderer === "streamgraph") {
    const layout = streamLayers(node.data);
    if (layout.labels.length < 2 || layout.series.length < 2) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">No chart data</text></svg>`;
    const step = (CHART.right - CHART.left) / Math.max(layout.labels.length - 1, 1);
    const layers = layout.layers.map((layer, index) => { const upper = layer.points.map((point, pointIndex) => ({ x: CHART.left + pointIndex * step, y: scaleLinear(point.end, layout.domain, CHART.bottom, CHART.top) })); const lower = layer.points.map((point, pointIndex) => ({ x: CHART.left + pointIndex * step, y: scaleLinear(point.start, layout.domain, CHART.bottom, CHART.top) })); return `<path d="${bandAreaPath(upper, lower)}" fill="${SERIES_COLORS[index % SERIES_COLORS.length]}" fill-opacity=".78" stroke="${surface}" stroke-width="1"><title>${escapeMarkup(layer.name)}</title></path>`; }).join("");
    const labels = layout.labels.map((label, index) => `<text x="${number(CHART.left + index * step)}" y="${CHART.bottom + 20}" text-anchor="${index === 0 ? "start" : index === layout.labels.length - 1 ? "end" : "middle"}" font-size="10" fill="${muted}">${escapeMarkup(label)}</text>`).join("");
    return `${open}${layers}${labels}</svg>`;
  }
  if (renderer === "error-bar") {
    const data = finiteErrorBarData(node.data);
    if (!data.length) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">No chart data</text></svg>`;
    const labels = orderedUnique(data.map((datum) => datum.label));
    const domain = numericDomain(data.flatMap((datum) => [datum.errorLow, datum.errorHigh]));
    const band = (CHART.right - CHART.left) / labels.length;
    const marks = data.map((datum, index) => { const x = CHART.left + band * (labels.indexOf(datum.label) + .5); const low = scaleLinear(datum.errorLow, domain, CHART.bottom, CHART.top); const high = scaleLinear(datum.errorHigh, domain, CHART.bottom, CHART.top); const value = scaleLinear(datum.value, domain, CHART.bottom, CHART.top); const mark = SERIES_COLORS[index % SERIES_COLORS.length]; return `<line x1="${number(x)}" y1="${number(high)}" x2="${number(x)}" y2="${number(low)}" stroke="${mark}" stroke-width="2"/><line x1="${number(x - 8)}" y1="${number(high)}" x2="${number(x + 8)}" y2="${number(high)}" stroke="${mark}" stroke-width="2"/><line x1="${number(x - 8)}" y1="${number(low)}" x2="${number(x + 8)}" y2="${number(low)}" stroke="${mark}" stroke-width="2"/><circle cx="${number(x)}" cy="${number(value)}" r="5" fill="${surface}" stroke="${mark}" stroke-width="3"><title>${escapeMarkup(`${datum.label}: ${formatChartValue(datum.value, node.valuePrefix, node.valueSuffix)} [${formatChartValue(datum.errorLow)}, ${formatChartValue(datum.errorHigh)}]`)}</title></circle>`; }).join("");
    return `${open}${categoryLabels(labels, tokens)}${marks}</svg>`;
  }
  if (renderer === "density" || renderer === "violin") {
    const density = densitySeries(node.data);
    if (!density.series.length || density.maxDensity <= 0) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">No chart data</text></svg>`;
    if (renderer === "density") {
      const densityDomain = { min: 0, max: density.maxDensity, ticks: [] };
      const marks = density.series.map((series, index) => { const points = series.points.map((point) => ({ x: scaleLinear(point.value, density.valueDomain, CHART.left, CHART.right), y: scaleLinear(point.density, densityDomain, CHART.bottom, CHART.top) })); const mark = SERIES_COLORS[index % SERIES_COLORS.length]; return `<path d="${linePath(points)} L${CHART.right},${CHART.bottom} L${CHART.left},${CHART.bottom} Z" fill="${mark}" fill-opacity=".14"/><path d="${linePath(points)}" fill="none" stroke="${mark}" stroke-width="3"><title>${escapeMarkup(series.name)}</title></path>`; }).join("");
      return `${open}${marks}</svg>`;
    }
    const band = (CHART.right - CHART.left) / density.series.length;
    const marks = density.series.map((series, index) => { const cx = CHART.left + band * (index + .5); const half = band * .38; const right = series.points.map((point) => ({ x: cx + point.density / density.maxDensity * half, y: scaleLinear(point.value, density.valueDomain, CHART.bottom, CHART.top) })); const left = [...series.points].reverse().map((point) => ({ x: cx - point.density / density.maxDensity * half, y: scaleLinear(point.value, density.valueDomain, CHART.bottom, CHART.top) })); const path = `${linePath(right)} ${left.map((point) => `L${number(point.x)},${number(point.y)}`).join(" ")} Z`; const mark = SERIES_COLORS[index % SERIES_COLORS.length]; return `<path d="${path}" fill="${mark}" fill-opacity=".36" stroke="${mark}" stroke-width="2"><title>${escapeMarkup(series.name)}</title></path><text x="${number(cx)}" y="${CHART.bottom + 20}" text-anchor="middle" font-size="10" fill="${muted}">${escapeMarkup(series.name)}</text>`; }).join("");
    return `${open}${marks}</svg>`;
  }
  if (renderer === "sunburst" || renderer === "icicle" || renderer === "circle-pack") {
    const layout = layoutHierarchy(node.data);
    if (!layout.segments.length) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">No chart data</text></svg>`;
    if (renderer === "sunburst") {
      const ring = 116 / Math.max(layout.maxDepth, 1);
      const marks = layout.segments.map((segment, index) => `<path d="${annularSectorPath(320, 160, Math.max(2, (segment.depth - 1) * ring), segment.depth * ring, segment.start, segment.end)}" fill="${SERIES_COLORS[(segment.depth + index) % SERIES_COLORS.length]}" fill-opacity="${number(0.72 + segment.depth * 0.05)}" stroke="${surface}" stroke-width="2"><title>${escapeMarkup(`${segment.id}: ${formatChartValue(segment.value, node.valuePrefix, node.valueSuffix)}`)}</title></path>`).join("");
      return `${open}${marks}</svg>`;
    }
    if (renderer === "icicle") {
      const row = 276 / Math.max(layout.maxDepth, 1);
      const marks = layout.segments.map((segment, index) => { const x = 24 + segment.start * 592; const width = (segment.end - segment.start) * 592; const y = 24 + (segment.depth - 1) * row; const label = width > 52 && row > 22 ? `<text x="${number(x + 8)}" y="${number(y + 18)}" font-size="10" font-weight="650" fill="${surface}">${escapeMarkup(segment.label)}</text>` : ""; return `<rect x="${number(x + 1)}" y="${number(y + 1)}" width="${number(Math.max(width - 2, 0))}" height="${number(Math.max(row - 2, 0))}" rx="3" fill="${SERIES_COLORS[(segment.depth + index) % SERIES_COLORS.length]}" fill-opacity=".78"><title>${escapeMarkup(`${segment.id}: ${formatChartValue(segment.value, node.valuePrefix, node.valueSuffix)}`)}</title></rect>${label}`; }).join("");
      return `${open}${marks}</svg>`;
    }
    const leaves = layout.segments.filter((segment) => !layout.segments.some((candidate) => candidate.id.startsWith(`${segment.id}/`)));
    const marks = leaves.map((segment, index) => { const cellWidth = (segment.end - segment.start) * 560; const radius = Math.max(5, Math.min(cellWidth * 0.46, 112)); const cx = 40 + (segment.start + segment.end) * 280; const label = radius > 22 ? `<text x="${number(cx)}" y="169" text-anchor="middle" font-size="10" font-weight="650" fill="${surface}">${escapeMarkup(segment.label.slice(0, Math.max(3, Math.floor(radius / 4))))}</text>` : ""; return `<circle cx="${number(cx)}" cy="165" r="${number(radius)}" fill="${SERIES_COLORS[index % SERIES_COLORS.length]}" fill-opacity=".72" stroke="${surface}" stroke-width="2"><title>${escapeMarkup(`${segment.id}: ${formatChartValue(segment.value, node.valuePrefix, node.valueSuffix)}`)}</title></circle>${label}`; }).join("");
    return `${open}${marks}</svg>`;
  }
  if (renderer === "chord") {
    const layout = chordGeometry(node.data, 320, 160, 112);
    if (!layout.links.length) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">No chart data</text></svg>`;
    const links = layout.links.map((link, index) => `<path d="M${number(link.sourcePoint.x)},${number(link.sourcePoint.y)} Q320,160 ${number(link.targetPoint.x)},${number(link.targetPoint.y)}" fill="none" stroke="${SERIES_COLORS[index % SERIES_COLORS.length]}" stroke-width="${number(Math.max(2, Math.min(18, Math.sqrt(link.value) * 2)))}" stroke-opacity=".35"><title>${escapeMarkup(`${link.source} to ${link.target}: ${formatChartValue(link.value, node.valuePrefix, node.valueSuffix)}`)}</title></path>`).join("");
    const nodes = layout.nodes.map((layoutNode, index) => { const middle = (layoutNode.start + layoutNode.end) / 2; const label = polarPoint(320, 160, 137, middle); return `<path d="${annularSectorPath(320, 160, 116, 130, (layoutNode.start + Math.PI / 2) / (Math.PI * 2), (layoutNode.end + Math.PI / 2) / (Math.PI * 2))}" fill="${SERIES_COLORS[index % SERIES_COLORS.length]}"/><text x="${number(label.x)}" y="${number(label.y + 4)}" text-anchor="middle" font-size="10" fill="${foreground}">${escapeMarkup(layoutNode.name)}</text>`; }).join("");
    return `${open}${links}${nodes}</svg>`;
  }
  if (renderer === "combo") {
    const data = finiteComboData(node.data);
    if (!data.length) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">No chart data</text></svg>`;
    const labels = orderedUnique(data.map((datum) => datum.label));
    const series = orderedUnique(data.map((datum) => datum.series?.trim() || "Value"));
    const meta = new Map(series.map((seriesName) => { const datum = data.find((candidate) => (candidate.series?.trim() || "Value") === seriesName)!; return [seriesName, { display: datum.display, axis: datum.axis ?? "left" }]; }));
    const leftData = data.filter((datum) => (datum.axis ?? "left") === "left");
    const rightData = data.filter((datum) => datum.axis === "right");
    const leftDomain = numericDomain(leftData.map((datum) => datum.value), { includeZero: leftData.some((datum) => datum.display === "bar") });
    const rightDomain = numericDomain(rightData.map((datum) => datum.value), { includeZero: rightData.some((datum) => datum.display === "bar") });
    const band = (CHART.right - CHART.left) / labels.length;
    const barSeries = series.filter((seriesName) => meta.get(seriesName)?.display === "bar");
    const marks = series.map((seriesName, seriesIndex) => {
      const seriesMeta = meta.get(seriesName)!;
      const domain = seriesMeta.axis === "right" ? rightDomain : leftDomain;
      const mark = SERIES_COLORS[seriesIndex % SERIES_COLORS.length];
      if (seriesMeta.display === "bar") {
        const groupWidth = band * .68;
        const barWidth = groupWidth / Math.max(barSeries.length, 1);
        const barIndex = barSeries.indexOf(seriesName);
        const zeroY = scaleLinear(0, domain, CHART.bottom, CHART.top);
        return labels.map((label, index) => { const datum = data.find((candidate) => candidate.label === label && (candidate.series?.trim() || "Value") === seriesName); if (!datum) return ""; const valueY = scaleLinear(datum.value, domain, CHART.bottom, CHART.top); const x = CHART.left + index * band + (band - groupWidth) / 2 + barIndex * barWidth; return `<rect x="${number(x)}" y="${number(Math.min(zeroY, valueY))}" width="${number(Math.max(barWidth - 2, 1))}" height="${number(Math.max(Math.abs(zeroY - valueY), 1))}" rx="2" fill="${mark}"/>`; }).join("");
      }
      const points = labels.flatMap((label, index) => { const datum = data.find((candidate) => candidate.label === label && (candidate.series?.trim() || "Value") === seriesName); return datum ? [{ x: CHART.left + band * (index + .5), y: scaleLinear(datum.value, domain, CHART.bottom, CHART.top) }] : []; });
      return `<path d="${linePath(points)}" fill="none" stroke="${mark}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${points.map((point) => `<circle cx="${number(point.x)}" cy="${number(point.y)}" r="3.5" fill="${surface}" stroke="${mark}" stroke-width="2"/>`).join("")}`;
    }).join("");
    const rightTicks = rightData.length ? rightDomain.ticks.map((tick) => `<text x="${CHART.right + 8}" y="${number(scaleLinear(tick, rightDomain, CHART.bottom, CHART.top) + 4)}" text-anchor="start" font-size="10" fill="${muted}">${escapeMarkup(formatChartValue(tick, node.valuePrefix, node.valueSuffix))}</text>`).join("") : "";
    return `${open}${chartGrid(leftDomain, node, tokens)}${rightTicks}${categoryLabels(labels, tokens)}${marks}</svg>`;
  }
  if (renderer === "stacked-area") {
    const data = finiteCartesianData(node.data);
    if (!data.length) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">No chart data</text></svg>`;
    const stack = stackAreaData(data);
    const band = (CHART.right - CHART.left) / Math.max(stack.labels.length - 1, 1);
    const marks = stack.layers.map((layer, index) => {
      const upper = layer.points.map((point, pointIndex) => ({ x: CHART.left + pointIndex * band, y: scaleLinear(point.end, stack.domain, CHART.bottom, CHART.top) }));
      const lower = layer.points.map((point, pointIndex) => ({ x: CHART.left + pointIndex * band, y: scaleLinear(point.start, stack.domain, CHART.bottom, CHART.top) }));
      const mark = SERIES_COLORS[index % SERIES_COLORS.length];
      return `<path d="${bandAreaPath(upper, lower)}" fill="${mark}" fill-opacity=".72" stroke="${mark}" stroke-width="1.5"/>`;
    }).join("");
    const labels = stack.labels.map((label, index) => `<text x="${number(CHART.left + index * band)}" y="${CHART.bottom + 20}" text-anchor="${index === 0 ? "start" : index === stack.labels.length - 1 ? "end" : "middle"}" font-size="10" fill="${muted}">${escapeMarkup(label.length > 9 ? `${label.slice(0, 8)}…` : label)}</text>`).join("");
    return `${open}${chartGrid(stack.domain, node, tokens)}${labels}${marks}</svg>`;
  }
  if (renderer === "gantt") {
    const data = finiteGanttData(node.data);
    if (!data.length) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">No chart data</text></svg>`;
    const starts = data.map((datum) => Date.parse(datum.start));
    const ends = data.map((datum) => Date.parse(datum.end));
    const minDate = Math.min(...starts);
    let maxDate = Math.max(...ends);
    if (minDate === maxDate) maxDate += 86_400_000;
    const domain = { min: minDate, max: maxDate, ticks: Array.from({ length: 5 }, (_, index) => minDate + (maxDate - minDate) * index / 4) };
    const rowHeight = (CHART.bottom - CHART.top) / data.length;
    const barHeight = Math.min(26, rowHeight * .58);
    const series = orderedUnique(data.map((datum) => datum.series?.trim() || "Task"));
    const ticks = domain.ticks.map((tick) => { const x = scaleLinear(tick, domain, CHART.left, CHART.right); const label = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(tick)); const anchor = tick === minDate ? "start" : tick === maxDate ? "end" : "middle"; return `<line x1="${number(x)}" y1="${CHART.top}" x2="${number(x)}" y2="${CHART.bottom}" stroke="${grid}"/><text x="${number(x)}" y="${CHART.bottom + 20}" text-anchor="${anchor}" font-size="10" fill="${muted}">${escapeMarkup(label)}</text>`; }).join("");
    const marks = data.map((datum, index) => {
      const y = CHART.top + rowHeight * (index + .5);
      const startX = scaleLinear(Date.parse(datum.start), domain, CHART.left, CHART.right);
      const endX = scaleLinear(Date.parse(datum.end), domain, CHART.left, CHART.right);
      const mark = SERIES_COLORS[series.indexOf(datum.series?.trim() || "Task") % SERIES_COLORS.length];
      const shape = startX === endX ? `<rect x="${number(startX - 5)}" y="${number(y - 5)}" width="10" height="10" transform="rotate(45 ${number(startX)} ${number(y)})" fill="${mark}"/>` : `<rect x="${number(startX)}" y="${number(y - barHeight / 2)}" width="${number(Math.max(endX - startX, 2))}" height="${number(barHeight)}" rx="4" fill="${mark}"/>`;
      return `<text x="${CHART.left - 9}" y="${number(y + 4)}" text-anchor="end" font-size="10" fill="${muted}">${escapeMarkup(datum.label)}</text>${shape}`;
    }).join("");
    return `${open}${ticks}${marks}</svg>`;
  }
  if (renderer === "histogram") {
    const histogram = binHistogram(finiteHistogramData(node.data));
    if (!histogram.bins.length) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">No chart data</text></svg>`;
    const countDomain = numericDomain(histogram.bins.map((bin) => bin.count), { includeZero: true });
    const band = (CHART.right - CHART.left) / histogram.bins.length;
    const marks = histogram.bins.map((bin, index) => {
      const y = scaleLinear(bin.count, countDomain, CHART.bottom, CHART.top);
      const labelEvery = Math.max(Math.ceil(histogram.bins.length / 6), 1);
      const label = index % labelEvery === 0 ? `<text x="${number(CHART.left + index * band)}" y="${CHART.bottom + 20}" text-anchor="middle" font-size="10" fill="${muted}">${escapeMarkup(formatChartValue(bin.start, node.valuePrefix, node.valueSuffix))}</text>` : "";
      return `<rect x="${number(CHART.left + index * band + 0.5)}" y="${number(y)}" width="${number(Math.max(band - 1, 1))}" height="${number(Math.max(CHART.bottom - y, bin.count ? 1 : 0))}" fill="${SERIES_COLORS[0]}" fill-opacity=".86"><title>${escapeMarkup(`${formatChartValue(bin.start)} to ${formatChartValue(bin.end)}: ${bin.count}`)}</title></rect>${label}`;
    }).join("");
    const finalLabel = `<text x="${CHART.right}" y="${CHART.bottom + 20}" text-anchor="end" font-size="10" fill="${muted}">${escapeMarkup(formatChartValue(histogram.bins.at(-1)!.end, node.valuePrefix, node.valueSuffix))}</text>`;
    return `${open}${chartGrid(countDomain, { ...node, valuePrefix: undefined, valueSuffix: undefined }, tokens)}${marks}${finalLabel}</svg>`;
  }
  if (renderer === "box-plot") {
    const data = finiteBoxPlotData(node.data);
    if (!data.length) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">No chart data</text></svg>`;
    const domain = numericDomain(data.flatMap((datum) => [datum.min, datum.max]));
    const rowHeight = (CHART.bottom - CHART.top) / data.length;
    const boxHeight = Math.min(30, rowHeight * 0.55);
    const ticks = domain.ticks.map((tick) => { const x = scaleLinear(tick, domain, CHART.left, CHART.right); return `<line x1="${number(x)}" y1="${CHART.top}" x2="${number(x)}" y2="${CHART.bottom}" stroke="${grid}"/><text x="${number(x)}" y="${CHART.bottom + 20}" text-anchor="middle" font-size="10" fill="${muted}">${escapeMarkup(formatChartValue(tick, node.valuePrefix, node.valueSuffix))}</text>`; }).join("");
    const marks = data.map((datum, index) => {
      const y = CHART.top + rowHeight * (index + 0.5);
      const values = [datum.min, datum.q1, datum.median, datum.q3, datum.max].map((value) => scaleLinear(value, domain, CHART.left, CHART.right));
      const mark = SERIES_COLORS[index % SERIES_COLORS.length];
      return `<text x="${CHART.left - 10}" y="${number(y + 4)}" text-anchor="end" font-size="11" fill="${muted}">${escapeMarkup(datum.label)}</text><line x1="${number(values[0])}" y1="${number(y)}" x2="${number(values[4])}" y2="${number(y)}" stroke="${mark}" stroke-width="2"/><line x1="${number(values[0])}" y1="${number(y - boxHeight * .28)}" x2="${number(values[0])}" y2="${number(y + boxHeight * .28)}" stroke="${mark}" stroke-width="2"/><line x1="${number(values[4])}" y1="${number(y - boxHeight * .28)}" x2="${number(values[4])}" y2="${number(y + boxHeight * .28)}" stroke="${mark}" stroke-width="2"/><rect x="${number(values[1])}" y="${number(y - boxHeight / 2)}" width="${number(Math.max(values[3] - values[1], 1))}" height="${number(boxHeight)}" fill="${mark}" fill-opacity=".2" stroke="${mark}" stroke-width="2"/><line x1="${number(values[2])}" y1="${number(y - boxHeight / 2)}" x2="${number(values[2])}" y2="${number(y + boxHeight / 2)}" stroke="${mark}" stroke-width="3"/>`;
    }).join("");
    return `${open}${ticks}${marks}</svg>`;
  }
  if (renderer === "bubble") {
    const data = finiteBubbleData(node.data);
    if (!data.length) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">No chart data</text></svg>`;
    const xDomain = numericDomain(data.map((datum) => datum.x));
    const yDomain = numericDomain(data.map((datum) => datum.y));
    const sizeDomain = numericDomain(data.map((datum) => Math.sqrt(datum.size)), { includeZero: true });
    const series = orderedUnique(data.map((datum) => datum.series?.trim() || "Value"));
    const marks = [...data].sort((a, b) => b.size - a.size).map((datum) => {
      const seriesName = datum.series?.trim() || "Value";
      return `<circle cx="${number(scaleLinear(datum.x, xDomain, CHART.left, CHART.right))}" cy="${number(scaleLinear(datum.y, yDomain, CHART.bottom, CHART.top))}" r="${number(scaleLinear(Math.sqrt(datum.size), sizeDomain, 5, 28))}" fill="${SERIES_COLORS[series.indexOf(seriesName) % SERIES_COLORS.length]}" fill-opacity=".58" stroke="${surface}" stroke-width="1.5"><title>${escapeMarkup(`${datum.label ? `${datum.label}: ` : ""}${datum.x}, ${datum.y}, size ${datum.size}`)}</title></circle>`;
    }).join("");
    const xTicks = xDomain.ticks.map((tick) => `<text x="${number(scaleLinear(tick, xDomain, CHART.left, CHART.right))}" y="${CHART.bottom + 20}" text-anchor="middle" font-size="10" fill="${muted}">${escapeMarkup(formatChartValue(tick))}</text>`).join("");
    return `${open}${chartGrid(yDomain, node, tokens)}${xTicks}${marks}</svg>`;
  }
  if (renderer === "sankey") {
    const layout = layoutSankey(finiteSankeyData(node.data), CHART.right - CHART.left, CHART.bottom - CHART.top);
    if (!layout) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">No valid acyclic flow data</text></svg>`;
    const maxLayer = Math.max(...layout.nodes.map((layoutNode) => layoutNode.layer));
    const links = layout.links.map((link) => `<path d="${link.path}" fill="none" stroke="${SERIES_COLORS[link.colorIndex % SERIES_COLORS.length]}" stroke-width="${number(link.width)}" stroke-opacity=".3"><title>${escapeMarkup(`${link.source} to ${link.target}: ${formatChartValue(link.value, node.valuePrefix, node.valueSuffix)}`)}</title></path>`).join("");
    const nodes = layout.nodes.map((layoutNode) => {
      const finalLayer = layoutNode.layer === maxLayer;
      return `<rect x="${number(layoutNode.x)}" y="${number(layoutNode.y)}" width="${number(layoutNode.width)}" height="${number(layoutNode.height)}" rx="2" fill="${SERIES_COLORS[layoutNode.colorIndex % SERIES_COLORS.length]}"/><text x="${number(finalLayer ? layoutNode.x - 7 : layoutNode.x + layoutNode.width + 7)}" y="${number(layoutNode.y + layoutNode.height / 2 + 4)}" text-anchor="${finalLayer ? "end" : "start"}" font-size="11" font-weight="600" fill="${foreground}">${escapeMarkup(layoutNode.id)}</text>`;
    }).join("");
    return `${open}<g transform="translate(${CHART.left} ${CHART.top})">${links}${nodes}</g></svg>`;
  }
  if (renderer === "heatmap") {
    const data = finiteHeatmapData(node.data);
    if (!data.length) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">No chart data</text></svg>`;
    const rows = orderedUnique(data.map((datum) => datum.row));
    const columns = orderedUnique(data.map((datum) => datum.column));
    const domain = numericDomain(data.map((datum) => datum.value));
    const cellWidth = (CHART.right - CHART.left) / columns.length;
    const cellHeight = (CHART.bottom - CHART.top) / rows.length;
    const values = new Map(data.map((datum) => [`${datum.row}\0${datum.column}`, datum.value]));
    const labels = rows.map((row, index) => `<text x="${CHART.left - 10}" y="${number(CHART.top + cellHeight * (index + 0.5) + 4)}" text-anchor="end" font-size="11" fill="${muted}">${escapeMarkup(row)}</text>`).join("") + columns.map((column, index) => `<text x="${number(CHART.left + cellWidth * (index + 0.5))}" y="${CHART.bottom + 20}" text-anchor="middle" font-size="11" fill="${muted}">${escapeMarkup(column)}</text>`).join("");
    const cells = rows.flatMap((row, rowIndex) => columns.map((column, columnIndex) => {
      const value = values.get(`${row}\0${column}`);
      const ratio = value === undefined ? 0 : (value - domain.min) / (domain.max - domain.min || 1);
      const fill = value === undefined ? surface : interpolateHexColor(surface, SERIES_COLORS[0], 0.15 + ratio * 0.85);
      return `<rect x="${number(CHART.left + columnIndex * cellWidth + 1)}" y="${number(CHART.top + rowIndex * cellHeight + 1)}" width="${number(Math.max(cellWidth - 2, 0))}" height="${number(Math.max(cellHeight - 2, 0))}" rx="3" fill="${fill}" stroke="${grid}" stroke-width=".5"/>`;
    })).join("");
    return `${open}${labels}${cells}</svg>`;
  }
  if (renderer === "candlestick") {
    const data = finiteCandlestickData(node.data);
    if (!data.length) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">No chart data</text></svg>`;
    const domain = numericDomain(data.flatMap((datum) => [datum.low, datum.high]));
    const band = (CHART.right - CHART.left) / data.length;
    const bodyWidth = Math.max(3, Math.min(24, band * 0.55));
    const candles = data.map((datum, index) => {
      const x = CHART.left + band * (index + 0.5);
      const highY = scaleLinear(datum.high, domain, CHART.bottom, CHART.top);
      const lowY = scaleLinear(datum.low, domain, CHART.bottom, CHART.top);
      const openY = scaleLinear(datum.open, domain, CHART.bottom, CHART.top);
      const closeY = scaleLinear(datum.close, domain, CHART.bottom, CHART.top);
      const rising = datum.close >= datum.open;
      const mark = rising ? SERIES_COLORS[2] : SERIES_COLORS[1];
      return `<line x1="${number(x)}" y1="${number(highY)}" x2="${number(x)}" y2="${number(lowY)}" stroke="${mark}" stroke-width="2"/><rect x="${number(x - bodyWidth / 2)}" y="${number(Math.min(openY, closeY))}" width="${number(bodyWidth)}" height="${number(Math.max(Math.abs(openY - closeY), 2))}" fill="${rising ? surface : mark}" stroke="${mark}" stroke-width="2"/><text x="${number(x)}" y="${CHART.bottom + 20}" text-anchor="middle" font-size="10" fill="${muted}">${escapeMarkup(datum.label)}</text>`;
    }).join("");
    return `${open}${chartGrid(domain, node, tokens)}${candles}</svg>`;
  }
  const data = finiteCartesianData(node.data);
  if (renderer === "waterfall") {
    if (!data.length) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">No chart data</text></svg>`;
    const waterfall = layoutWaterfall(data);
    const band = (CHART.right - CHART.left) / waterfall.steps.length;
    const barWidth = Math.max(3, band * 0.64);
    const marks = waterfall.steps.map((step, index) => {
      const x = CHART.left + band * index + (band - barWidth) / 2;
      const startY = scaleLinear(step.start, waterfall.domain, CHART.bottom, CHART.top);
      const endY = scaleLinear(step.end, waterfall.domain, CHART.bottom, CHART.top);
      const nextX = CHART.left + band * (index + 1) + (band - barWidth) / 2;
      const connector = index < waterfall.steps.length - 1 ? `<line x1="${number(x + barWidth)}" y1="${number(endY)}" x2="${number(nextX)}" y2="${number(endY)}" stroke="${muted}" stroke-dasharray="3 3"/>` : "";
      return `${connector}<rect x="${number(x)}" y="${number(Math.min(startY, endY))}" width="${number(barWidth)}" height="${number(Math.max(Math.abs(startY - endY), 1))}" rx="2" fill="${step.value >= 0 ? SERIES_COLORS[2] : SERIES_COLORS[1]}"/><text x="${number(x + barWidth / 2)}" y="${CHART.bottom + 20}" text-anchor="middle" font-size="10" fill="${muted}">${escapeMarkup(step.label)}</text>`;
    }).join("");
    return `${open}${chartGrid(waterfall.domain, node, tokens)}${marks}</svg>`;
  }
  if (renderer !== "radar" && renderer !== "treemap" && renderer !== "funnel" && renderer !== "gauge") return null;
  if (!data.length) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">No chart data</text></svg>`;
  if (renderer === "treemap") {
    const rectangles = layoutTreemap(data.filter((datum) => datum.value > 0), CHART.right - CHART.left, CHART.bottom - CHART.top);
    const max = Math.max(...rectangles.map((rectangle) => rectangle.value), 1);
    const marks = rectangles.map((rectangle, index) => {
      const fill = interpolateHexColor(surface, SERIES_COLORS[index % SERIES_COLORS.length], 0.58 + rectangle.value / max * 0.32);
      return `<rect x="${number(CHART.left + rectangle.x + 1)}" y="${number(CHART.top + rectangle.y + 1)}" width="${number(Math.max(rectangle.width - 2, 0))}" height="${number(Math.max(rectangle.height - 2, 0))}" rx="4" fill="${fill}"/><text x="${number(CHART.left + rectangle.x + 9)}" y="${number(CHART.top + rectangle.y + 18)}" font-size="11" font-weight="700" fill="${foreground}">${escapeMarkup(rectangle.label)}</text>`;
    }).join("");
    return `${open}${marks}</svg>`;
  }
  if (renderer === "funnel") {
    const stages = data.filter((datum) => datum.value >= 0);
    const max = Math.max(...stages.map((datum) => datum.value), 0);
    if (max <= 0) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">No chart data</text></svg>`;
    const rowHeight = Math.min(54, 246 / stages.length);
    const top = (CHART.height - rowHeight * stages.length) / 2;
    const marks = stages.map((datum, index) => {
      const topWidth = Math.max(42, datum.value / max * 430);
      const next = stages[index + 1];
      const bottomWidth = next ? Math.max(42, next.value / max * 430) : Math.max(42, topWidth * 0.78);
      const y = top + index * rowHeight;
      const points = `${number(320 - topWidth / 2)},${number(y)} ${number(320 + topWidth / 2)},${number(y)} ${number(320 + bottomWidth / 2)},${number(y + rowHeight - 2)} ${number(320 - bottomWidth / 2)},${number(y + rowHeight - 2)}`;
      return `<polygon points="${points}" fill="${SERIES_COLORS[index % SERIES_COLORS.length]}"/><text x="320" y="${number(y + rowHeight / 2 + 4)}" text-anchor="middle" font-size="11" font-weight="700" fill="${surface}">${escapeMarkup(`${datum.label} · ${formatChartValue(datum.value, node.valuePrefix, node.valueSuffix)}`)}</text>`;
    }).join("");
    return `${open}${marks}</svg>`;
  }
  if (renderer === "gauge") {
    const datum = data[0];
    const max = Math.max(100, datum.value, 1);
    const ratio = Math.min(Math.max(datum.value / max, 0), 1);
    const background = arcPath(320, 222, 132, Math.PI, Math.PI * 2);
    const value = ratio > 0 ? `<path d="${arcPath(320, 222, 132, Math.PI, Math.PI + Math.PI * ratio)}" fill="none" stroke="${SERIES_COLORS[0]}" stroke-width="30" stroke-linecap="round"/>` : "";
    return `${open}<path d="${background}" fill="none" stroke="${grid}" stroke-width="30" stroke-linecap="round"/>${value}<text x="320" y="210" text-anchor="middle" font-size="38" font-weight="700" fill="${foreground}">${escapeMarkup(formatChartValue(datum.value, node.valuePrefix, node.valueSuffix))}</text><text x="320" y="234" text-anchor="middle" font-size="12" fill="${muted}">${escapeMarkup(datum.label)}</text></svg>`;
  }
  const labels = orderedUnique(data.map((datum) => datum.label));
  if (labels.length < 3) return `${open}<text x="320" y="165" text-anchor="middle" fill="${muted}">Radar charts need at least three categories</text></svg>`;
  const series = orderedUnique(data.map((datum) => datum.series?.trim() || "Value"));
  const domain = numericDomain(data.map((datum) => datum.value), { includeZero: true });
  const angle = (index: number) => -Math.PI / 2 + index * Math.PI * 2 / labels.length;
  const axes = labels.map((label, index) => {
    const edge = polarPoint(320, 154, 112, angle(index));
    const text = polarPoint(320, 154, 130, angle(index));
    return `<line x1="320" y1="154" x2="${number(edge.x)}" y2="${number(edge.y)}" stroke="${grid}"/><text x="${number(text.x)}" y="${number(text.y + 4)}" text-anchor="middle" font-size="11" fill="${muted}">${escapeMarkup(label)}</text>`;
  }).join("");
  const polygons = series.map((seriesName, seriesIndex) => {
    const points = labels.map((label, index) => {
      const value = data.find((datum) => datum.label === label && (datum.series?.trim() || "Value") === seriesName)?.value ?? domain.min;
      return polarPoint(320, 154, 112 * Math.min(Math.max((value - domain.min) / (domain.max - domain.min || 1), 0), 1), angle(index));
    });
    const mark = SERIES_COLORS[seriesIndex % SERIES_COLORS.length];
    return `<polygon points="${points.map((point) => `${number(point.x)},${number(point.y)}`).join(" ")}" fill="${mark}" fill-opacity=".14" stroke="${mark}" stroke-width="2.5"/>`;
  }).join("");
  return `${open}${axes}${polygons}</svg>`;
}

function chartSvg(node: EngineChartNode, tokens: EngineTokens): string {
  const foreground = color(tokens, "ink");
  const surface = color(tokens, "panel");
  const cartesian = finiteCartesianData(node.data);
  const scatter = finiteScatterData(node.data);
  const open = `<svg class="engine-chart" viewBox="0 0 ${CHART.width} ${CHART.height}" role="img" aria-label="${escapeMarkup(`${node.title}, ${node.chartType} chart`)}"><title>${escapeMarkup(node.title)}</title>`;
  const renderer = exportRendererForChart(node.chartType);
  if (renderer === "geographic") {
    return geographicChartSvg({ type: node.chartType, title: node.title, data: node.data }, {
      foreground: color(tokens, "ink"),
      muted: color(tokens, "quiet"),
      grid: color(tokens, "rule"),
      surface: color(tokens, "panel"),
      series: [color(tokens, "cobalt"), color(tokens, "orange"), "#1D8A6A", "#8755D9"],
    });
  }
  const advanced = advancedChartSvg(node, tokens, open, renderer);
  if (advanced) return advanced;
  if (renderer === "donut") {
    const data = cartesian.filter((datum) => datum.value > 0);
    const total = data.reduce((sum, datum) => sum + datum.value, 0);
    if (!data.length || total <= 0) return `${open}<text x="320" y="165" text-anchor="middle" fill="${escapeMarkup(color(tokens, "quiet"))}">No chart data</text></svg>`;
    const radius = 88;
    const circumference = Math.PI * 2 * radius;
    let offset = 0;
    const arcs = data.map((datum, index) => {
      const length = datum.value / total * circumference;
      const dashOffset = -offset;
      offset += length;
      return `<circle cx="250" cy="150" r="${radius}" fill="none" stroke="${SERIES_COLORS[index % SERIES_COLORS.length]}" stroke-width="42" stroke-dasharray="${number(length)} ${number(circumference - length)}" stroke-dashoffset="${number(dashOffset)}"/>`;
    }).join("");
    const legend = data.map((datum, index) => `<rect x="420" y="${74 + index * 28}" width="10" height="10" rx="2" fill="${SERIES_COLORS[index % SERIES_COLORS.length]}"/><text x="438" y="${83 + index * 28}" font-size="11" fill="${escapeMarkup(color(tokens, "quiet"))}">${escapeMarkup(datum.label)}</text><text x="600" y="${83 + index * 28}" text-anchor="end" font-size="11" font-weight="650" fill="${escapeMarkup(foreground)}">${escapeMarkup(formatChartValue(datum.value, node.valuePrefix, node.valueSuffix))}</text>`).join("");
    return `${open}<g transform="rotate(-90 250 150)">${arcs}</g><text x="250" y="147" text-anchor="middle" font-size="12" fill="${escapeMarkup(color(tokens, "quiet"))}">Total</text><text x="250" y="171" text-anchor="middle" font-size="20" font-weight="700" fill="${escapeMarkup(foreground)}">${escapeMarkup(formatChartValue(total, node.valuePrefix, node.valueSuffix))}</text>${legend}</svg>`;
  }
  if (renderer === "scatter") {
    if (!scatter.length) return `${open}<text x="320" y="165" text-anchor="middle" fill="${escapeMarkup(color(tokens, "quiet"))}">No chart data</text></svg>`;
    const xDomain = numericDomain(scatter.map((datum) => datum.x));
    const yDomain = numericDomain(scatter.map((datum) => datum.y));
    const series = orderedUnique(scatter.map((datum) => datum.series?.trim() || "Value"));
    const points = scatter.map((datum) => `<circle cx="${number(scaleLinear(datum.x, xDomain, CHART.left, CHART.right))}" cy="${number(scaleLinear(datum.y, yDomain, CHART.bottom, CHART.top))}" r="5.5" fill="${SERIES_COLORS[series.indexOf(datum.series?.trim() || "Value") % SERIES_COLORS.length]}" fill-opacity=".82"><title>${escapeMarkup(`${datum.label ? `${datum.label}: ` : ""}${datum.x}, ${datum.y}`)}</title></circle>`).join("");
    const xTicks = xDomain.ticks.map((tick) => `<text x="${number(scaleLinear(tick, xDomain, CHART.left, CHART.right))}" y="${CHART.bottom + 21}" text-anchor="middle" font-size="11" fill="${escapeMarkup(color(tokens, "quiet"))}">${escapeMarkup(formatChartValue(tick))}</text>`).join("");
    return `${open}${chartGrid(yDomain, node, tokens)}${xTicks}${points}</svg>`;
  }
  if (!cartesian.length) return `${open}<text x="320" y="165" text-anchor="middle" fill="${escapeMarkup(color(tokens, "quiet"))}">No chart data</text></svg>`;
  if (renderer === "stacked-bar") {
    const stack = stackCartesianData(cartesian);
    const band = (CHART.right - CHART.left) / stack.labels.length;
    const barWidth = band * 0.66;
    const segments = stack.segments.map((segment) => {
      const x = CHART.left + stack.labels.indexOf(segment.label) * band + (band - barWidth) / 2;
      const startY = scaleLinear(segment.start, stack.domain, CHART.bottom, CHART.top);
      const endY = scaleLinear(segment.end, stack.domain, CHART.bottom, CHART.top);
      return `<rect x="${number(x)}" y="${number(Math.min(startY, endY))}" width="${number(barWidth)}" height="${number(Math.max(Math.abs(startY - endY), segment.value === 0 ? 0 : 1))}" fill="${SERIES_COLORS[stack.series.indexOf(segment.series) % SERIES_COLORS.length]}"/>`;
    }).join("");
    return `${open}${chartGrid(stack.domain, node, tokens)}${categoryLabels(stack.labels, tokens)}${segments}</svg>`;
  }
  const labels = orderedUnique(cartesian.map((datum) => datum.label));
  const series = orderedUnique(cartesian.map((datum) => datum.series?.trim() || "Value"));
  const domain = numericDomain(cartesian.map((datum) => datum.value), { includeZero: node.chartType === "bar" });
  const band = (CHART.right - CHART.left) / labels.length;
  const zeroY = scaleLinear(0, domain, CHART.bottom, CHART.top);
  let marks = "";
  if (node.chartType === "bar") {
    marks = cartesian.map((datum) => {
      const seriesName = datum.series?.trim() || "Value";
      const groupWidth = band * 0.72;
      const barWidth = Math.max(2, groupWidth / series.length);
      const x = CHART.left + labels.indexOf(datum.label) * band + (band - groupWidth) / 2 + series.indexOf(seriesName) * barWidth;
      const valueY = scaleLinear(datum.value, domain, CHART.bottom, CHART.top);
      const barHeight = Math.max(Math.abs(zeroY - valueY), 1);
      const y = Math.min(valueY, zeroY);
      const valueLabelY = datum.value >= 0 ? y - 6 : y + barHeight + 13;
      return `<rect x="${number(x)}" y="${number(y)}" width="${number(Math.max(barWidth - 2, 1))}" height="${number(barHeight)}" rx="3" fill="${SERIES_COLORS[series.indexOf(seriesName) % SERIES_COLORS.length]}"/><text x="${number(x + barWidth / 2)}" y="${number(valueLabelY)}" text-anchor="middle" font-size="10" fill="${escapeMarkup(foreground)}">${escapeMarkup(formatChartValue(datum.value, node.valuePrefix, node.valueSuffix))}</text>`;
    }).join("");
  } else {
    marks = series.map((seriesName, seriesIndex) => {
      const points = labels.flatMap((label, index) => {
        const datum = cartesian.find((candidate) => candidate.label === label && (candidate.series?.trim() || "Value") === seriesName);
        return datum ? [{ x: CHART.left + band * (index + 0.5), y: scaleLinear(datum.value, domain, CHART.bottom, CHART.top) }] : [];
      });
      const seriesColor = SERIES_COLORS[seriesIndex % SERIES_COLORS.length];
      const baseline = Math.min(Math.max(zeroY, CHART.top), CHART.bottom);
      const area = node.chartType === "area" ? `<path d="${areaPath(points, baseline)}" fill="${seriesColor}" fill-opacity=".16"/>` : "";
      const dots = points.map((point) => `<circle cx="${number(point.x)}" cy="${number(point.y)}" r="4" fill="${escapeMarkup(surface)}" stroke="${seriesColor}" stroke-width="2.5"/>`).join("");
      return `${area}<path d="${linePath(points)}" fill="none" stroke="${seriesColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
    }).join("");
  }
  return `${open}${chartGrid(domain, node, tokens)}${categoryLabels(labels, tokens)}${marks}</svg>`;
}

function graphNodeMarkup(node: LayoutGraphNode, tokens: EngineTokens): string {
  const ink = escapeMarkup(color(tokens, "ink"));
  const panel = escapeMarkup(color(tokens, "panel"));
  const accent = escapeMarkup(color(tokens, "cobalt"));
  const fill = node.tone === "accent" ? "#E9EDFF" : node.tone === "positive" ? "#E6F4EE" : node.tone === "warning" ? "#FFF0EA" : panel;
  const label = escapeMarkup(node.label);
  if (node.kind === "decision") {
    const points = `${node.x + node.width / 2},${node.y} ${node.x + node.width},${node.y + node.height / 2} ${node.x + node.width / 2},${node.y + node.height} ${node.x},${node.y + node.height / 2}`;
    return `<polygon points="${points}" fill="${fill}" stroke="${ink}" stroke-width="1.5"/><text x="${number(node.x + node.width / 2)}" y="${number(node.y + node.height / 2 + 5)}" text-anchor="middle" font-size="14" font-weight="650" fill="${ink}">${label}</text>`;
  }
  if (node.kind === "database") {
    return `<rect x="${node.x}" y="${node.y + 10}" width="${node.width}" height="${node.height - 20}" fill="${fill}" stroke="${ink}" stroke-width="1.5"/><ellipse cx="${number(node.x + node.width / 2)}" cy="${node.y + 10}" rx="${number(node.width / 2)}" ry="10" fill="#EEF1EB" stroke="${ink}" stroke-width="1.5"/><ellipse cx="${number(node.x + node.width / 2)}" cy="${node.y + node.height - 10}" rx="${number(node.width / 2)}" ry="10" fill="${fill}" stroke="${ink}" stroke-width="1.5"/><text x="${number(node.x + node.width / 2)}" y="${number(node.y + node.height / 2 + 5)}" text-anchor="middle" font-size="14" font-weight="650" fill="${ink}">${label}</text>`;
  }
  const radius = node.kind === "person" ? node.height / 2 : node.kind === "process" ? 12 : node.kind === "service" ? 20 : 7;
  const stroke = node.kind === "service" ? accent : ink;
  const fields = node.kind === "entity" ? (node.fields ?? []).map((field, index) => `<text x="${node.x + 14}" y="${node.y + 62 + index * 22}" font-size="10" fill="${ink}">${escapeMarkup(`${field.key === "primary" ? "PK " : field.key === "foreign" ? "FK " : ""}${field.name}${field.type ? `  ${field.type}` : ""}`)}</text>`).join("") : "";
  const labelY = node.kind === "entity" ? node.y + 28 : node.y + node.height / 2 + 5;
  const divider = node.kind === "entity" ? `<line x1="${node.x}" y1="${node.y + 44}" x2="${node.x + node.width}" y2="${node.y + 44}" stroke="${ink}"/>` : "";
  return `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${number(radius)}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>${divider}<text x="${number(node.x + node.width / 2)}" y="${number(labelY)}" text-anchor="middle" font-size="14" font-weight="650" fill="${ink}">${label}</text>${fields}`;
}

function graphSvg(node: EngineGraphNode, tokens: EngineTokens): string {
  const graph = layoutGraph(node.graph);
  const markerId = `arrow-${node.id.replace(/[^a-zA-Z0-9_-]/g, "") || "graph"}`;
  const rule = escapeMarkup(color(tokens, "rule"));
  const edges = graph.edges.map((edge) => {
    const points = edge.points.map((point) => `${number(point.x)},${number(point.y)}`).join(" ");
    const marker = edge.kind === "association" ? "" : ` marker-end="url(#${markerId})"`;
    const dash = edge.kind === "dependency" ? ` stroke-dasharray="6 5"` : "";
    const label = edge.label && edge.labelPoint ? `<text x="${number(edge.labelPoint.x)}" y="${number(edge.labelPoint.y - 6)}" text-anchor="middle" font-size="10" fill="${escapeMarkup(color(tokens, "ink"))}">${escapeMarkup(edge.label)}</text>` : "";
    return `<polyline points="${points}" fill="none" stroke="${rule}" stroke-width="1.5" stroke-linejoin="round"${dash}${marker}/>${label}`;
  }).join("");
  const nodes = graph.nodes.map((graphNode) => graphNodeMarkup(graphNode, tokens)).join("");
  return `<svg class="engine-graph" viewBox="0 0 ${graph.width} ${graph.height}" role="img" aria-label="${escapeMarkup(node.title)}"><title>${escapeMarkup(node.title)}</title><defs><marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L9 5L1 9z" fill="${rule}"/></marker></defs>${edges}${nodes}</svg>`;
}

function nodeHtml(node: EngineNode, tokens: EngineTokens): string {
  const style = styleCss(node.style, tokens);
  const styleAttribute = style ? ` style="${escapeMarkup(style)}"` : "";
  if (node.type === "frame") {
    return `<div class="engine-frame" data-node-id="${escapeMarkup(node.id)}" data-layout="${node.layout.mode}" data-direction="${node.layout.direction ?? ""}" style="${escapeMarkup(frameStyle(node, tokens))}">${node.children.map((child) => nodeHtml(child, tokens)).join("")}</div>`;
  }
  if (node.type === "text") return `<div class="engine-text-${node.variant}" data-node-id="${escapeMarkup(node.id)}"${styleAttribute}>${escapeMarkup(node.content)}</div>`;
  if (node.type === "metric") {
    const accent = node.tone === "positive" ? color(tokens, "cobalt") : node.tone === "warning" ? color(tokens, "orange") : color(tokens, "ink");
    return `<section class="engine-card" data-node-id="${escapeMarkup(node.id)}"${styleAttribute}><div class="engine-metric-label">${escapeMarkup(node.label)}</div><div class="engine-metric-value" style="color:${escapeMarkup(accent)}">${escapeMarkup(node.value)}</div><div class="engine-metric-detail">${escapeMarkup(node.detail)}</div></section>`;
  }
  const badge = node.type === "graph" ? "deterministic graph" : `deterministic ${node.chartType}`;
  const graphic = node.type === "graph" ? graphSvg(node, tokens) : chartSvg(node, tokens);
  return `<section class="engine-card" data-node-id="${escapeMarkup(node.id)}"${styleAttribute}><div class="engine-card-header"><h2 class="engine-card-title">${escapeMarkup(node.title)}</h2><span class="engine-badge">${badge}</span></div>${graphic}</section>`;
}

function documentVariables(document: EngineDocument): string {
  return `--ink:${cssValue(color(document.tokens, "ink"))};--paper:${cssValue(color(document.tokens, "paper"))};--panel:${cssValue(color(document.tokens, "panel"))};--rule:${cssValue(color(document.tokens, "rule"))};--quiet:${cssValue(color(document.tokens, "quiet"))}`;
}

function documentBody(document: EngineDocument): string {
  return `<main class="engine-artboard" data-engine="dom-css" data-version="2" style="${escapeMarkup(documentVariables(document))};background:${escapeMarkup(resolveColor(document.artboard.background, document.tokens) ?? color(document.tokens, "paper"))};min-height:${document.artboard.minHeight}px">${document.children.map((node) => nodeHtml(node, document.tokens)).join("")}</main>`;
}

function reactStyle(style: EngineStyle | undefined, tokens: EngineTokens): Record<string, string | number> {
  if (!style) return {};
  const output: Record<string, string | number> = {};
  const background = resolveColor(style.background, tokens);
  const foreground = resolveColor(style.color, tokens);
  const borderColor = resolveColor(style.borderColor, tokens);
  if (background) output.background = cssValue(background);
  if (foreground) output.color = cssValue(foreground);
  if (borderColor) output.borderColor = cssValue(borderColor);
  if (Number.isFinite(style.borderWidth)) {
    output.borderWidth = style.borderWidth!;
    output.borderStyle = "solid";
  }
  if (Number.isFinite(style.borderRadius)) output.borderRadius = style.borderRadius!;
  if (Number.isFinite(style.minHeight)) output.minHeight = style.minHeight!;
  if (typeof style.width === "number" && Number.isFinite(style.width)) output.width = style.width;
  if (typeof style.width === "string" && /^(?:100|[1-9]?\d)%$/.test(style.width)) output.width = style.width;
  if (Number.isFinite(style.flex)) output.flex = style.flex!;
  if (style.alignSelf) output.alignSelf = cssValue(style.alignSelf);
  return output;
}

function frameReactStyle(node: EngineFrameNode, tokens: EngineTokens): Record<string, string | number> {
  const style: Record<string, string | number> = node.layout.mode === "grid"
    ? { display: "grid", gridTemplateColumns: `repeat(${node.layout.columns ?? 1}, minmax(0, 1fr))` }
    : { display: "flex", flexDirection: node.layout.direction ?? "row" };
  style.gap = node.layout.gap;
  style.padding = node.layout.padding;
  if (node.layout.align) style.alignItems = cssValue(node.layout.align);
  if (node.layout.justify) style.justifyContent = cssValue(node.layout.justify);
  return { ...style, ...reactStyle(node.style, tokens) };
}

function svgMarkupToJsx(markup: string): string {
  const attributes: Record<string, string> = {
    class: "className",
    "fill-opacity": "fillOpacity",
    "font-size": "fontSize",
    "font-weight": "fontWeight",
    "marker-end": "markerEnd",
    "stroke-dasharray": "strokeDasharray",
    "stroke-dashoffset": "strokeDashoffset",
    "stroke-linecap": "strokeLinecap",
    "stroke-linejoin": "strokeLinejoin",
    "stroke-opacity": "strokeOpacity",
    "stroke-width": "strokeWidth",
    "text-anchor": "textAnchor",
  };
  return Object.entries(attributes).reduce(
    (output, [htmlName, jsxName]) => output.replace(new RegExp(`\\b${htmlName}=`, "g"), `${jsxName}=`),
    markup,
  );
}

function indent(value: string, depth: number): string {
  const padding = "  ".repeat(depth);
  return value.split("\n").map((line) => `${padding}${line}`).join("\n");
}

function reactNode(node: EngineNode, tokens: EngineTokens, depth: number): string {
  const padding = "  ".repeat(depth);
  const id = JSON.stringify(node.id);
  if (node.type === "frame") {
    const children = node.children.map((child) => reactNode(child, tokens, depth + 1)).join("\n");
    return `${padding}<div className="engine-frame" data-node-id={${id}} data-layout="${node.layout.mode}" data-direction="${node.layout.direction ?? ""}" style={${JSON.stringify(frameReactStyle(node, tokens))}}>\n${children}\n${padding}</div>`;
  }
  const style = JSON.stringify(reactStyle(node.style, tokens));
  if (node.type === "text") {
    return `${padding}<div className="engine-text-${node.variant}" data-node-id={${id}} style={${style}}>{${JSON.stringify(node.content)}}</div>`;
  }
  if (node.type === "metric") {
    const accent = node.tone === "positive" ? color(tokens, "cobalt") : node.tone === "warning" ? color(tokens, "orange") : color(tokens, "ink");
    return `${padding}<section className="engine-card" data-node-id={${id}} style={${style}}>\n${padding}  <div className="engine-metric-label">{${JSON.stringify(node.label)}}</div>\n${padding}  <div className="engine-metric-value" style={${JSON.stringify({ color: accent })}}>{${JSON.stringify(node.value)}}</div>\n${padding}  <div className="engine-metric-detail">{${JSON.stringify(node.detail)}}</div>\n${padding}</section>`;
  }
  const badge = node.type === "graph" ? "deterministic graph" : `deterministic ${node.chartType}`;
  const graphic = svgMarkupToJsx(node.type === "graph" ? graphSvg(node, tokens) : chartSvg(node, tokens));
  return `${padding}<section className="engine-card" data-node-id={${id}} style={${style}}>\n${padding}  <div className="engine-card-header">\n${padding}    <h2 className="engine-card-title">{${JSON.stringify(node.title)}}</h2>\n${padding}    <span className="engine-badge">${badge}</span>\n${padding}  </div>\n${indent(graphic, depth + 1)}\n${padding}</section>`;
}

function componentName(name: string): string {
  const words = name.match(/[a-zA-Z0-9]+/g) ?? [];
  const joined = words.map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join("");
  const safe = joined && /^[a-zA-Z]/.test(joined) ? joined : `Drawstack${joined}`;
  return `${safe || "Drawstack"}Graphic`;
}

function reactCss(document: EngineDocument): string {
  const componentCss = EXPORT_CSS
    .replace("*{box-sizing:border-box}\nhtml,body{margin:0;padding:0}\nbody{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;color:var(--ink);background:var(--paper);-webkit-print-color-adjust:exact;print-color-adjust:exact}\n", "")
    .replace(
      ".engine-artboard{width:100%;min-height:100%;overflow:hidden}",
      `.engine-artboard,.engine-artboard *{box-sizing:border-box}\n.engine-artboard{${documentVariables(document)};width:100%;min-height:100%;overflow:hidden;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}`,
    );
  return componentCss.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

export function engineV2ExportFilename(name: string, extension: "json" | "svg" | "html" | "tsx"): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "drawstack";
  return `${slug}.${extension}`;
}

export function createEngineV2JsonExport(document: EngineDocument): EngineV2ExportPayload {
  return {
    filename: engineV2ExportFilename(document.name, "json"),
    mimeType: "application/json;charset=utf-8",
    contents: `${JSON.stringify(document, null, 2)}\n`,
  };
}

export function serializeEngineV2Svg(document: EngineDocument): string {
  const width = Math.max(1, Math.round(document.artboard.width));
  const height = Math.max(1, Math.round(document.artboard.minHeight));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeMarkup(document.name)}"><title>${escapeMarkup(document.name)}</title><foreignObject x="0" y="0" width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;min-height:${height}px"><style>${EXPORT_CSS}</style>${documentBody(document)}</div></foreignObject></svg>\n`;
}

export function createEngineV2SvgExport(document: EngineDocument): EngineV2ExportPayload {
  return {
    filename: engineV2ExportFilename(document.name, "svg"),
    mimeType: "image/svg+xml;charset=utf-8",
    contents: serializeEngineV2Svg(document),
  };
}

export function serializeEngineV2PrintHtml(document: EngineDocument): string {
  const width = Math.max(1, Math.round(document.artboard.width));
  const height = Math.max(1, Math.round(document.artboard.minHeight));
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeMarkup(document.name)}</title><style>${EXPORT_CSS}\n@page{size:${width}px ${height}px;margin:0}body{width:${width}px;min-height:${height}px}@media print{body{width:${width}px}.engine-artboard{min-height:${height}px}}</style></head><body>${documentBody(document)}</body></html>\n`;
}

export function createEngineV2PrintHtmlExport(document: EngineDocument): EngineV2ExportPayload {
  return {
    filename: engineV2ExportFilename(document.name, "html"),
    mimeType: "text/html;charset=utf-8",
    contents: serializeEngineV2PrintHtml(document),
  };
}

export function serializeEngineV2ReactTsx(document: EngineDocument): string {
  const name = componentName(document.name);
  const rootStyle = {
    width: "100%",
    maxWidth: document.artboard.width,
    minHeight: document.artboard.minHeight,
    margin: "0 auto",
    overflow: "hidden",
    background: resolveColor(document.artboard.background, document.tokens) ?? color(document.tokens, "paper"),
  };
  const children = document.children.map((node) => reactNode(node, document.tokens, 2)).join("\n");
  return `export default function ${name}() {\n  return (\n    <main className="engine-artboard" data-engine="dom-css" data-version={2} style={${JSON.stringify(rootStyle)}}>\n      <style>{\`${reactCss(document)}\`}</style>\n${children}\n    </main>\n  );\n}\n`;
}

export function createEngineV2ReactTsxExport(document: EngineDocument): EngineV2ExportPayload {
  return {
    filename: engineV2ExportFilename(document.name, "tsx"),
    mimeType: "text/typescript;charset=utf-8",
    contents: serializeEngineV2ReactTsx(document),
  };
}

export function supportedEngineV2ExportChartTypes(): readonly DeterministicChartType[] {
  return CHART_FAMILY_TYPES;
}
