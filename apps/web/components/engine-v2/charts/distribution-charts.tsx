import { bandAreaPath, formatChartValue, linePath, orderedUnique, scaleLinear } from "@/lib/engine-v2/chart-layout";
import { densitySeries, finiteErrorBarData, streamLayers } from "@/lib/engine-v2/distribution-layout";
import type { DeterministicChartPalette, DeterministicChartSpec } from "@/lib/engine-v2/chart-types";

type Props = { spec: DeterministicChartSpec; palette: DeterministicChartPalette };
const WIDTH = 640;
const HEIGHT = 330;
const PLOT = { left: 62, top: 24, right: 616, bottom: 270 };

function EmptyChart({ spec, palette }: Props) {
  return <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm" style={{ borderColor: palette.grid, color: palette.muted }} role="img" aria-label={`${spec.title}. No chart data.`}>{spec.emptyMessage ?? "Add data to render this chart."}</div>;
}

export function StreamgraphChart({ spec, palette }: Props) {
  const layout = streamLayers(spec.data);
  if (layout.labels.length < 2 || layout.series.length < 2) return <EmptyChart spec={spec} palette={palette} />;
  const step = (PLOT.right - PLOT.left) / Math.max(layout.labels.length - 1, 1);
  return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, streamgraph`}>
    {layout.layers.map((layer, index) => { const upper = layer.points.map((point, pointIndex) => ({ x: PLOT.left + pointIndex * step, y: scaleLinear(point.end, layout.domain, PLOT.bottom, PLOT.top) })); const lower = layer.points.map((point, pointIndex) => ({ x: PLOT.left + pointIndex * step, y: scaleLinear(point.start, layout.domain, PLOT.bottom, PLOT.top) })); return <path key={layer.name} d={bandAreaPath(upper, lower)} fill={palette.series[index % palette.series.length]} fillOpacity="0.78" stroke={palette.surface} strokeWidth="1"><title>{layer.name}</title></path>; })}
    {layout.labels.map((label, index) => <text key={label} x={PLOT.left + index * step} y={PLOT.bottom + 20} textAnchor={index === 0 ? "start" : index === layout.labels.length - 1 ? "end" : "middle"} fontSize="10" fill={palette.muted}>{label}</text>)}
  </svg>;
}

export function ErrorBarChart({ spec, palette }: Props) {
  const data = finiteErrorBarData(spec.data);
  if (!data.length) return <EmptyChart spec={spec} palette={palette} />;
  const labels = orderedUnique(data.map((datum) => datum.label));
  const domain = { min: Math.min(...data.map((datum) => datum.errorLow)), max: Math.max(...data.map((datum) => datum.errorHigh)), ticks: [] };
  const band = (PLOT.right - PLOT.left) / labels.length;
  return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, error bar chart`}>
    {data.map((datum, index) => { const x = PLOT.left + band * (labels.indexOf(datum.label) + 0.5); const low = scaleLinear(datum.errorLow, domain, PLOT.bottom, PLOT.top); const high = scaleLinear(datum.errorHigh, domain, PLOT.bottom, PLOT.top); const value = scaleLinear(datum.value, domain, PLOT.bottom, PLOT.top); const color = palette.series[index % palette.series.length]; return <g key={`${datum.label}-${index}`}><line x1={x} y1={high} x2={x} y2={low} stroke={color} strokeWidth="2" /><line x1={x - 8} y1={high} x2={x + 8} y2={high} stroke={color} strokeWidth="2" /><line x1={x - 8} y1={low} x2={x + 8} y2={low} stroke={color} strokeWidth="2" /><circle cx={x} cy={value} r="5" fill={palette.surface} stroke={color} strokeWidth="3"><title>{datum.label}: {formatChartValue(datum.value, spec.valuePrefix, spec.valueSuffix)} [{formatChartValue(datum.errorLow)}, {formatChartValue(datum.errorHigh)}]</title></circle><text x={x} y={PLOT.bottom + 20} textAnchor="middle" fontSize="10" fill={palette.muted}>{datum.label}</text></g>; })}
  </svg>;
}

export function DensityChart({ spec, palette }: Props) {
  const density = densitySeries(spec.data);
  if (!density.series.length || density.maxDensity <= 0) return <EmptyChart spec={spec} palette={palette} />;
  const densityDomain = { min: 0, max: density.maxDensity, ticks: [] };
  return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, density chart`}>
    {density.series.map((series, index) => { const points = series.points.map((point) => ({ x: scaleLinear(point.value, density.valueDomain, PLOT.left, PLOT.right), y: scaleLinear(point.density, densityDomain, PLOT.bottom, PLOT.top) })); const color = palette.series[index % palette.series.length]; return <g key={series.name}><path d={`${linePath(points)} L${PLOT.right},${PLOT.bottom} L${PLOT.left},${PLOT.bottom} Z`} fill={color} fillOpacity="0.14" /><path d={linePath(points)} fill="none" stroke={color} strokeWidth="3"><title>{series.name}</title></path></g>; })}
  </svg>;
}

export function ViolinChart({ spec, palette }: Props) {
  const density = densitySeries(spec.data);
  if (!density.series.length || density.maxDensity <= 0) return <EmptyChart spec={spec} palette={palette} />;
  const band = (PLOT.right - PLOT.left) / density.series.length;
  return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, violin chart`}>
    {density.series.map((series, index) => { const cx = PLOT.left + band * (index + 0.5); const half = band * 0.38; const right = series.points.map((point) => ({ x: cx + point.density / density.maxDensity * half, y: scaleLinear(point.value, density.valueDomain, PLOT.bottom, PLOT.top) })); const left = [...series.points].reverse().map((point) => ({ x: cx - point.density / density.maxDensity * half, y: scaleLinear(point.value, density.valueDomain, PLOT.bottom, PLOT.top) })); const path = `${linePath(right)} ${left.map((point) => `L${point.x},${point.y}`).join(" ")} Z`; return <g key={series.name}><path d={path} fill={palette.series[index % palette.series.length]} fillOpacity="0.36" stroke={palette.series[index % palette.series.length]} strokeWidth="2"><title>{series.name}</title></path><text x={cx} y={PLOT.bottom + 20} textAnchor="middle" fontSize="10" fill={palette.muted}>{series.name}</text></g>; })}
  </svg>;
}
