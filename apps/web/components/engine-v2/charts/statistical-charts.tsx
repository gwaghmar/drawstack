import {
  binHistogram,
  finiteBoxPlotData,
  finiteBubbleData,
  finiteHistogramData,
  formatChartValue,
  numericDomain,
  orderedUnique,
  scaleLinear,
} from "@/lib/engine-v2/chart-layout";
import type { DeterministicChartPalette, DeterministicChartSpec } from "@/lib/engine-v2/chart-types";

type StatisticalChartProps = { spec: DeterministicChartSpec; palette: DeterministicChartPalette };
const VIEWBOX = { width: 640, height: 330 };
const PLOT = { left: 66, top: 24, right: 616, bottom: 270 };

function EmptyStatisticalChart({ spec, palette }: StatisticalChartProps) {
  return <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm" style={{ borderColor: palette.grid, color: palette.muted }} role="img" aria-label={`${spec.title}. No chart data.`}>{spec.emptyMessage ?? "Add valid data to render this chart."}</div>;
}

function YGrid({ domain, palette, format = (value: number) => String(value) }: { domain: ReturnType<typeof numericDomain>; palette: DeterministicChartPalette; format?: (value: number) => string }) {
  return <>{domain.ticks.map((tick) => { const y = scaleLinear(tick, domain, PLOT.bottom, PLOT.top); return <g key={tick}><line x1={PLOT.left} y1={y} x2={PLOT.right} y2={y} stroke={palette.grid} /><text x={PLOT.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill={palette.muted}>{format(tick)}</text></g>; })}</>;
}

export function HistogramChart({ spec, palette }: StatisticalChartProps) {
  const histogram = binHistogram(finiteHistogramData(spec.data));
  if (!histogram.bins.length) return <EmptyStatisticalChart spec={spec} palette={palette} />;
  const countDomain = numericDomain(histogram.bins.map((bin) => bin.count), { includeZero: true, targetTicks: 4 });
  const band = (PLOT.right - PLOT.left) / histogram.bins.length;
  return (
    <svg viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, histogram`}>
      <YGrid domain={countDomain} palette={palette} />
      {histogram.bins.map((bin, index) => {
        const y = scaleLinear(bin.count, countDomain, PLOT.bottom, PLOT.top);
        return <g key={bin.start}><rect x={PLOT.left + index * band + 0.5} y={y} width={Math.max(band - 1, 1)} height={Math.max(PLOT.bottom - y, bin.count ? 1 : 0)} fill={palette.series[0]} fillOpacity="0.86"><title>{formatChartValue(bin.start)} to {formatChartValue(bin.end)}: {bin.count}</title></rect>{index % Math.max(Math.ceil(histogram.bins.length / 6), 1) === 0 ? <text x={PLOT.left + index * band} y={PLOT.bottom + 20} textAnchor="middle" fontSize="10" fill={palette.muted}>{formatChartValue(bin.start, spec.valuePrefix, spec.valueSuffix)}</text> : null}</g>;
      })}
      <text x={PLOT.right} y={PLOT.bottom + 20} textAnchor="end" fontSize="10" fill={palette.muted}>{formatChartValue(histogram.bins.at(-1)!.end, spec.valuePrefix, spec.valueSuffix)}</text>
      {spec.xLabel ? <text x={(PLOT.left + PLOT.right) / 2} y={VIEWBOX.height - 5} textAnchor="middle" fontSize="11" fill={palette.muted}>{spec.xLabel}</text> : null}
    </svg>
  );
}

export function BoxPlotChart({ spec, palette }: StatisticalChartProps) {
  const data = finiteBoxPlotData(spec.data);
  if (!data.length) return <EmptyStatisticalChart spec={spec} palette={palette} />;
  const domain = numericDomain(data.flatMap((datum) => [datum.min, datum.max]));
  const rowHeight = (PLOT.bottom - PLOT.top) / data.length;
  const boxHeight = Math.min(30, rowHeight * 0.55);
  return (
    <svg viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, box plot`}>
      {domain.ticks.map((tick) => { const x = scaleLinear(tick, domain, PLOT.left, PLOT.right); return <g key={tick}><line x1={x} y1={PLOT.top} x2={x} y2={PLOT.bottom} stroke={palette.grid} /><text x={x} y={PLOT.bottom + 20} textAnchor="middle" fontSize="10" fill={palette.muted}>{formatChartValue(tick, spec.valuePrefix, spec.valueSuffix)}</text></g>; })}
      {data.map((datum, index) => {
        const y = PLOT.top + rowHeight * (index + 0.5);
        const minX = scaleLinear(datum.min, domain, PLOT.left, PLOT.right);
        const q1X = scaleLinear(datum.q1, domain, PLOT.left, PLOT.right);
        const medianX = scaleLinear(datum.median, domain, PLOT.left, PLOT.right);
        const q3X = scaleLinear(datum.q3, domain, PLOT.left, PLOT.right);
        const maxX = scaleLinear(datum.max, domain, PLOT.left, PLOT.right);
        const color = palette.series[index % palette.series.length];
        return <g key={`${datum.label}-${index}`}><text x={PLOT.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill={palette.muted}>{datum.label.length > 12 ? `${datum.label.slice(0, 11)}…` : datum.label}</text><line x1={minX} y1={y} x2={maxX} y2={y} stroke={color} strokeWidth="2" /><line x1={minX} y1={y - boxHeight * 0.28} x2={minX} y2={y + boxHeight * 0.28} stroke={color} strokeWidth="2" /><line x1={maxX} y1={y - boxHeight * 0.28} x2={maxX} y2={y + boxHeight * 0.28} stroke={color} strokeWidth="2" /><rect x={q1X} y={y - boxHeight / 2} width={Math.max(q3X - q1X, 1)} height={boxHeight} fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2" /><line x1={medianX} y1={y - boxHeight / 2} x2={medianX} y2={y + boxHeight / 2} stroke={color} strokeWidth="3"><title>{datum.label}: median {formatChartValue(datum.median, spec.valuePrefix, spec.valueSuffix)}</title></line></g>;
      })}
    </svg>
  );
}

export function BubbleChart({ spec, palette }: StatisticalChartProps) {
  const data = finiteBubbleData(spec.data);
  if (!data.length) return <EmptyStatisticalChart spec={spec} palette={palette} />;
  const xDomain = numericDomain(data.map((datum) => datum.x));
  const yDomain = numericDomain(data.map((datum) => datum.y));
  const sizeDomain = numericDomain(data.map((datum) => Math.sqrt(datum.size)), { includeZero: true });
  const series = orderedUnique(data.map((datum) => datum.series?.trim() || "Value"));
  return (
    <svg viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, bubble chart`}>
      <YGrid domain={yDomain} palette={palette} format={(value) => formatChartValue(value, spec.valuePrefix, spec.valueSuffix)} />
      {xDomain.ticks.map((tick) => <text key={tick} x={scaleLinear(tick, xDomain, PLOT.left, PLOT.right)} y={PLOT.bottom + 20} textAnchor="middle" fontSize="10" fill={palette.muted}>{formatChartValue(tick)}</text>)}
      {[...data].sort((a, b) => b.size - a.size).map((datum, index) => {
        const seriesName = datum.series?.trim() || "Value";
        const radius = scaleLinear(Math.sqrt(datum.size), sizeDomain, 5, 28);
        return <circle key={`${datum.label ?? "bubble"}-${index}`} cx={scaleLinear(datum.x, xDomain, PLOT.left, PLOT.right)} cy={scaleLinear(datum.y, yDomain, PLOT.bottom, PLOT.top)} r={radius} fill={palette.series[series.indexOf(seriesName) % palette.series.length]} fillOpacity="0.58" stroke={palette.surface} strokeWidth="1.5"><title>{datum.label ? `${datum.label}: ` : ""}${datum.x}, ${datum.y}, size ${datum.size}</title></circle>;
      })}
      {spec.xLabel ? <text x={(PLOT.left + PLOT.right) / 2} y={VIEWBOX.height - 5} textAnchor="middle" fontSize="11" fill={palette.muted}>{spec.xLabel}</text> : null}
    </svg>
  );
}
