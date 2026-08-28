import {
  bandAreaPath,
  finiteCartesianData,
  finiteComboData,
  finiteGanttData,
  formatChartValue,
  linePath,
  numericDomain,
  orderedUnique,
  scaleLinear,
  stackAreaData,
} from "@/lib/engine-v2/chart-layout";
import type { DeterministicChartPalette, DeterministicChartSpec } from "@/lib/engine-v2/chart-types";

type SeriesChartProps = { spec: DeterministicChartSpec; palette: DeterministicChartPalette };
const VIEWBOX = { width: 640, height: 330 };
const PLOT = { left: 62, top: 24, right: 606, bottom: 270 };

function EmptySeriesChart({ spec, palette }: SeriesChartProps) {
  return <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm" style={{ borderColor: palette.grid, color: palette.muted }} role="img" aria-label={`${spec.title}. No chart data.`}>{spec.emptyMessage ?? "Add valid data to render this chart."}</div>;
}

function Legend({ names, palette }: { names: string[]; palette: DeterministicChartPalette }) {
  return <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-label="Chart legend">{names.map((name, index) => <span key={name} className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: palette.muted }}><span className="h-2 w-2 rounded-sm" style={{ background: palette.series[index % palette.series.length] }} />{name}</span>)}</div>;
}

export function ComboChart({ spec, palette }: SeriesChartProps) {
  const data = finiteComboData(spec.data);
  if (!data.length) return <EmptySeriesChart spec={spec} palette={palette} />;
  const labels = orderedUnique(data.map((datum) => datum.label));
  const series = orderedUnique(data.map((datum) => datum.series?.trim() || "Value"));
  const meta = new Map(series.map((name) => {
    const datum = data.find((candidate) => (candidate.series?.trim() || "Value") === name)!;
    return [name, { display: datum.display, axis: datum.axis ?? "left" }];
  }));
  const axisData = (axis: "left" | "right") => data.filter((datum) => (datum.axis ?? "left") === axis);
  const leftData = axisData("left");
  const rightData = axisData("right");
  const leftDomain = numericDomain(leftData.map((datum) => datum.value), { includeZero: leftData.some((datum) => datum.display === "bar") });
  const rightDomain = numericDomain(rightData.map((datum) => datum.value), { includeZero: rightData.some((datum) => datum.display === "bar") });
  const band = (PLOT.right - PLOT.left) / labels.length;
  const barSeries = series.filter((name) => meta.get(name)?.display === "bar");
  return (
    <>
      <svg viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, combination chart`}>
        {leftDomain.ticks.map((tick) => { const y = scaleLinear(tick, leftDomain, PLOT.bottom, PLOT.top); return <g key={`left-${tick}`}><line x1={PLOT.left} y1={y} x2={PLOT.right} y2={y} stroke={palette.grid} /><text x={PLOT.left - 9} y={y + 4} textAnchor="end" fontSize="10" fill={palette.muted}>{formatChartValue(tick, spec.valuePrefix, spec.valueSuffix)}</text></g>; })}
        {rightData.length ? rightDomain.ticks.map((tick) => <text key={`right-${tick}`} x={PLOT.right + 8} y={scaleLinear(tick, rightDomain, PLOT.bottom, PLOT.top) + 4} textAnchor="start" fontSize="10" fill={palette.muted}>{formatChartValue(tick, spec.valuePrefix, spec.valueSuffix)}</text>) : null}
        {labels.map((label, index) => <text key={label} x={PLOT.left + band * (index + 0.5)} y={PLOT.bottom + 20} textAnchor="middle" fontSize="10" fill={palette.muted}>{label.length > 9 ? `${label.slice(0, 8)}…` : label}</text>)}
        {series.map((seriesName, seriesIndex) => {
          const seriesMeta = meta.get(seriesName)!;
          const domain = seriesMeta.axis === "right" ? rightDomain : leftDomain;
          const color = palette.series[seriesIndex % palette.series.length];
          if (seriesMeta.display === "bar") {
            const groupWidth = band * 0.68;
            const barWidth = groupWidth / Math.max(barSeries.length, 1);
            const barIndex = barSeries.indexOf(seriesName);
            const zeroY = scaleLinear(0, domain, PLOT.bottom, PLOT.top);
            return <g key={seriesName}>{labels.map((label, index) => { const datum = data.find((candidate) => candidate.label === label && (candidate.series?.trim() || "Value") === seriesName); if (!datum) return null; const valueY = scaleLinear(datum.value, domain, PLOT.bottom, PLOT.top); const x = PLOT.left + index * band + (band - groupWidth) / 2 + barIndex * barWidth; return <rect key={label} x={x} y={Math.min(zeroY, valueY)} width={Math.max(barWidth - 2, 1)} height={Math.max(Math.abs(zeroY - valueY), 1)} rx="2" fill={color} />; })}</g>;
          }
          const points = labels.flatMap((label, index) => { const datum = data.find((candidate) => candidate.label === label && (candidate.series?.trim() || "Value") === seriesName); return datum ? [{ x: PLOT.left + band * (index + 0.5), y: scaleLinear(datum.value, domain, PLOT.bottom, PLOT.top) }] : []; });
          return <g key={seriesName}><path d={linePath(points)} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="3.5" fill={palette.surface} stroke={color} strokeWidth="2" />)}</g>;
        })}
      </svg>
      {spec.showLegend !== false ? <Legend names={series} palette={palette} /> : null}
    </>
  );
}

export function StackedAreaChart({ spec, palette }: SeriesChartProps) {
  const data = finiteCartesianData(spec.data);
  if (!data.length) return <EmptySeriesChart spec={spec} palette={palette} />;
  const stack = stackAreaData(data);
  const band = (PLOT.right - PLOT.left) / Math.max(stack.labels.length - 1, 1);
  return (
    <>
      <svg viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, stacked area chart`}>
        {stack.domain.ticks.map((tick) => { const y = scaleLinear(tick, stack.domain, PLOT.bottom, PLOT.top); return <g key={tick}><line x1={PLOT.left} y1={y} x2={PLOT.right} y2={y} stroke={palette.grid} /><text x={PLOT.left - 9} y={y + 4} textAnchor="end" fontSize="10" fill={palette.muted}>{formatChartValue(tick, spec.valuePrefix, spec.valueSuffix)}</text></g>; })}
        {stack.layers.map((layer, layerIndex) => {
          const upper = layer.points.map((point, index) => ({ x: PLOT.left + index * band, y: scaleLinear(point.end, stack.domain, PLOT.bottom, PLOT.top) }));
          const lower = layer.points.map((point, index) => ({ x: PLOT.left + index * band, y: scaleLinear(point.start, stack.domain, PLOT.bottom, PLOT.top) }));
          const color = palette.series[layerIndex % palette.series.length];
          return <path key={layer.series} d={bandAreaPath(upper, lower)} fill={color} fillOpacity="0.72" stroke={color} strokeWidth="1.5" />;
        })}
        {stack.labels.map((label, index) => <text key={label} x={PLOT.left + index * band} y={PLOT.bottom + 20} textAnchor={index === 0 ? "start" : index === stack.labels.length - 1 ? "end" : "middle"} fontSize="10" fill={palette.muted}>{label.length > 9 ? `${label.slice(0, 8)}…` : label}</text>)}
      </svg>
      {spec.showLegend !== false ? <Legend names={stack.layers.map((layer) => layer.series)} palette={palette} /> : null}
    </>
  );
}

function dateLabel(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(timestamp));
}

export function GanttChart({ spec, palette }: SeriesChartProps) {
  const data = finiteGanttData(spec.data);
  if (!data.length) return <EmptySeriesChart spec={spec} palette={palette} />;
  const starts = data.map((datum) => Date.parse(datum.start));
  const ends = data.map((datum) => Date.parse(datum.end));
  let minDate = Math.min(...starts);
  let maxDate = Math.max(...ends);
  if (minDate === maxDate) maxDate = minDate + 86_400_000;
  const dateDomain = { min: minDate, max: maxDate, ticks: Array.from({ length: 5 }, (_, index) => minDate + (maxDate - minDate) * index / 4) };
  const rowHeight = (PLOT.bottom - PLOT.top) / data.length;
  const barHeight = Math.min(26, rowHeight * 0.58);
  const series = orderedUnique(data.map((datum) => datum.series?.trim() || "Task"));
  return (
    <>
      <svg viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, Gantt chart`}>
        {dateDomain.ticks.map((tick) => { const x = scaleLinear(tick, dateDomain, PLOT.left, PLOT.right); return <g key={tick}><line x1={x} y1={PLOT.top} x2={x} y2={PLOT.bottom} stroke={palette.grid} /><text x={x} y={PLOT.bottom + 20} textAnchor={tick === minDate ? "start" : tick === maxDate ? "end" : "middle"} fontSize="10" fill={palette.muted}>{dateLabel(tick)}</text></g>; })}
        {data.map((datum, index) => {
          const y = PLOT.top + rowHeight * (index + 0.5);
          const startX = scaleLinear(Date.parse(datum.start), dateDomain, PLOT.left, PLOT.right);
          const endX = scaleLinear(Date.parse(datum.end), dateDomain, PLOT.left, PLOT.right);
          const color = palette.series[series.indexOf(datum.series?.trim() || "Task") % palette.series.length];
          return <g key={`${datum.label}-${index}`}><text x={PLOT.left - 9} y={y + 4} textAnchor="end" fontSize="10" fill={palette.muted}>{datum.label.length > 13 ? `${datum.label.slice(0, 12)}…` : datum.label}</text>{startX === endX ? <rect x={startX - 5} y={y - 5} width="10" height="10" transform={`rotate(45 ${startX} ${y})`} fill={color}><title>{datum.label}: {datum.start}</title></rect> : <rect x={startX} y={y - barHeight / 2} width={Math.max(endX - startX, 2)} height={barHeight} rx="4" fill={color}><title>{datum.label}: {datum.start} to {datum.end}</title></rect>}</g>;
        })}
      </svg>
      {spec.showLegend !== false && series.length > 1 ? <Legend names={series} palette={palette} /> : null}
    </>
  );
}
