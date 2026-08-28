import {
  finiteCandlestickData,
  finiteCartesianData,
  finiteHeatmapData,
  formatChartValue,
  interpolateHexColor,
  layoutTreemap,
  numericDomain,
  orderedUnique,
  polarPoint,
  scaleLinear,
} from "@/lib/engine-v2/chart-layout";
import type { DeterministicChartPalette, DeterministicChartSpec } from "@/lib/engine-v2/chart-types";

type AdvancedChartProps = {
  spec: DeterministicChartSpec;
  palette: DeterministicChartPalette;
};

const WIDTH = 640;
const HEIGHT = 330;
const PLOT = { left: 64, top: 24, right: 616, bottom: 276 };

function EmptyChart({ spec, palette }: AdvancedChartProps) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm" style={{ borderColor: palette.grid, color: palette.muted }} role="img" aria-label={`${spec.title}. No chart data.`}>
      {spec.emptyMessage ?? "Add data to render this chart."}
    </div>
  );
}

function ChartLegend({ names, palette }: { names: string[]; palette: DeterministicChartPalette }) {
  if (names.length < 2) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-label="Chart legend">
      {names.map((name, index) => <span key={name} className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: palette.muted }}><span className="h-2 w-2 rounded-sm" style={{ background: palette.series[index % palette.series.length] }} />{name}</span>)}
    </div>
  );
}

export function RadarChart({ spec, palette }: AdvancedChartProps) {
  const data = finiteCartesianData(spec.data);
  if (data.length === 0) return <EmptyChart spec={spec} palette={palette} />;
  const labels = orderedUnique(data.map((datum) => datum.label));
  const series = orderedUnique(data.map((datum) => datum.series?.trim() || "Value"));
  if (labels.length < 3) return <EmptyChart spec={{ ...spec, emptyMessage: spec.emptyMessage ?? "Radar charts need at least three categories." }} palette={palette} />;
  const domain = numericDomain(data.map((datum) => datum.value), { includeZero: true });
  const center = { x: 320, y: 154 };
  const radius = 112;
  const angleFor = (index: number) => -Math.PI / 2 + (index * Math.PI * 2) / labels.length;
  const polygon = (ratio: number) => labels.map((_, index) => {
    const point = polarPoint(center.x, center.y, radius * ratio, angleFor(index));
    return `${point.x},${point.y}`;
  }).join(" ");

  return (
    <>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, radar chart`}>
        {[0.25, 0.5, 0.75, 1].map((ratio) => <polygon key={ratio} points={polygon(ratio)} fill="none" stroke={palette.grid} />)}
        {labels.map((label, index) => {
          const edge = polarPoint(center.x, center.y, radius, angleFor(index));
          const text = polarPoint(center.x, center.y, radius + 18, angleFor(index));
          return <g key={label}><line x1={center.x} y1={center.y} x2={edge.x} y2={edge.y} stroke={palette.grid} /><text x={text.x} y={text.y + 4} textAnchor={Math.abs(text.x - center.x) < 5 ? "middle" : text.x > center.x ? "start" : "end"} fontSize="11" fill={palette.muted}>{label.length > 14 ? `${label.slice(0, 13)}…` : label}</text></g>;
        })}
        {series.map((seriesName, seriesIndex) => {
          const points = labels.map((label, index) => {
            const value = data.find((datum) => datum.label === label && (datum.series?.trim() || "Value") === seriesName)?.value ?? domain.min;
            const ratio = Math.min(Math.max((value - domain.min) / (domain.max - domain.min || 1), 0), 1);
            return polarPoint(center.x, center.y, radius * ratio, angleFor(index));
          });
          const color = palette.series[seriesIndex % palette.series.length];
          return <g key={seriesName}><polygon points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill={color} fillOpacity="0.14" stroke={color} strokeWidth="2.5" />{points.map((point, index) => <circle key={labels[index]} cx={point.x} cy={point.y} r="3" fill={palette.surface} stroke={color} strokeWidth="2" />)}</g>;
        })}
      </svg>
      {spec.showLegend !== false ? <ChartLegend names={series} palette={palette} /> : null}
    </>
  );
}

export function HeatmapChart({ spec, palette }: AdvancedChartProps) {
  const data = finiteHeatmapData(spec.data);
  if (data.length === 0) return <EmptyChart spec={spec} palette={palette} />;
  const rows = orderedUnique(data.map((datum) => datum.row));
  const columns = orderedUnique(data.map((datum) => datum.column));
  const domain = numericDomain(data.map((datum) => datum.value));
  const cellWidth = (PLOT.right - PLOT.left) / columns.length;
  const cellHeight = (PLOT.bottom - PLOT.top) / rows.length;
  const values = new Map(data.map((datum) => [`${datum.row}\u0000${datum.column}`, datum.value]));
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, heatmap`}>
      {rows.map((row, rowIndex) => <text key={row} x={PLOT.left - 10} y={PLOT.top + cellHeight * (rowIndex + 0.5) + 4} textAnchor="end" fontSize="11" fill={palette.muted}>{row.length > 12 ? `${row.slice(0, 11)}…` : row}</text>)}
      {columns.map((column, columnIndex) => <text key={column} x={PLOT.left + cellWidth * (columnIndex + 0.5)} y={PLOT.bottom + 20} textAnchor="middle" fontSize="11" fill={palette.muted}>{column.length > 10 ? `${column.slice(0, 9)}…` : column}</text>)}
      {rows.flatMap((row, rowIndex) => columns.map((column, columnIndex) => {
        const value = values.get(`${row}\u0000${column}`);
        const ratio = value === undefined ? 0 : (value - domain.min) / (domain.max - domain.min || 1);
        const fill = value === undefined ? palette.surface : interpolateHexColor(palette.surface, palette.series[0], 0.15 + ratio * 0.85);
        return <g key={`${row}-${column}`}><rect x={PLOT.left + columnIndex * cellWidth + 1} y={PLOT.top + rowIndex * cellHeight + 1} width={Math.max(cellWidth - 2, 0)} height={Math.max(cellHeight - 2, 0)} rx="3" fill={fill} stroke={palette.grid} strokeWidth="0.5" />{spec.showValues && value !== undefined && cellWidth >= 34 && cellHeight >= 22 ? <text x={PLOT.left + cellWidth * (columnIndex + 0.5)} y={PLOT.top + cellHeight * (rowIndex + 0.5) + 4} textAnchor="middle" fontSize="10" fontWeight="600" fill={ratio > 0.55 ? palette.surface : palette.foreground}>{formatChartValue(value, spec.valuePrefix, spec.valueSuffix)}</text> : null}</g>;
      }))}
      {spec.xLabel ? <text x={(PLOT.left + PLOT.right) / 2} y={HEIGHT - 5} textAnchor="middle" fontSize="11" fill={palette.muted}>{spec.xLabel}</text> : null}
    </svg>
  );
}

export function TreemapChart({ spec, palette }: AdvancedChartProps) {
  const data = finiteCartesianData(spec.data).filter((datum) => datum.value > 0);
  const rectangles = layoutTreemap(data, PLOT.right - PLOT.left, PLOT.bottom - PLOT.top);
  if (rectangles.length === 0) return <EmptyChart spec={spec} palette={palette} />;
  const max = Math.max(...rectangles.map((rectangle) => rectangle.value));
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, treemap`}>
      {rectangles.map((rectangle, index) => {
        const x = PLOT.left + rectangle.x;
        const y = PLOT.top + rectangle.y;
        const showLabel = rectangle.width >= 54 && rectangle.height >= 32;
        const color = interpolateHexColor(palette.surface, palette.series[index % palette.series.length], 0.58 + (rectangle.value / max) * 0.32);
        return <g key={`${rectangle.label}-${index}`}><rect x={x + 1} y={y + 1} width={Math.max(rectangle.width - 2, 0)} height={Math.max(rectangle.height - 2, 0)} rx="4" fill={color} />{showLabel ? <><text x={x + 9} y={y + 18} fontSize="11" fontWeight="700" fill={palette.foreground}>{rectangle.label.length > Math.floor(rectangle.width / 8) ? `${rectangle.label.slice(0, Math.max(Math.floor(rectangle.width / 8) - 1, 2))}…` : rectangle.label}</text>{rectangle.height >= 48 ? <text x={x + 9} y={y + 34} fontSize="10" fill={palette.foreground} fillOpacity="0.72">{formatChartValue(rectangle.value, spec.valuePrefix, spec.valueSuffix)}</text> : null}</> : null}</g>;
      })}
    </svg>
  );
}

export function FunnelChart({ spec, palette }: AdvancedChartProps) {
  const data = finiteCartesianData(spec.data).filter((datum) => datum.value >= 0);
  if (data.length === 0) return <EmptyChart spec={spec} palette={palette} />;
  const max = Math.max(...data.map((datum) => datum.value));
  if (max <= 0) return <EmptyChart spec={spec} palette={palette} />;
  const center = WIDTH / 2;
  const maxWidth = 430;
  const rowHeight = Math.min(54, 246 / data.length);
  const top = (HEIGHT - rowHeight * data.length) / 2;
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, funnel chart`}>
      {data.map((datum, index) => {
        const topWidth = Math.max(42, (datum.value / max) * maxWidth);
        const next = data[index + 1];
        const bottomWidth = next ? Math.max(42, (next.value / max) * maxWidth) : Math.max(42, topWidth * 0.78);
        const y = top + index * rowHeight;
        const points = `${center - topWidth / 2},${y} ${center + topWidth / 2},${y} ${center + bottomWidth / 2},${y + rowHeight - 2} ${center - bottomWidth / 2},${y + rowHeight - 2}`;
        return <g key={`${datum.label}-${index}`}><polygon points={points} fill={palette.series[index % palette.series.length]} fillOpacity={0.92 - (index % palette.series.length) * 0.04} /><text x={center} y={y + rowHeight / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={palette.surface}>{datum.label} · {formatChartValue(datum.value, spec.valuePrefix, spec.valueSuffix)}</text></g>;
      })}
    </svg>
  );
}

function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarPoint(cx, cy, radius, startAngle);
  const end = polarPoint(cx, cy, radius, endAngle);
  return `M${start.x},${start.y} A${radius},${radius} 0 ${endAngle - startAngle > Math.PI ? 1 : 0} 1 ${end.x},${end.y}`;
}

export function GaugeChart({ spec, palette }: AdvancedChartProps) {
  const datum = finiteCartesianData(spec.data)[0];
  if (!datum) return <EmptyChart spec={spec} palette={palette} />;
  const min = Number.isFinite(spec.minValue) ? spec.minValue as number : 0;
  const defaultMax = Math.max(100, datum.value, min + 1);
  const max = Number.isFinite(spec.maxValue) && (spec.maxValue as number) > min ? spec.maxValue as number : defaultMax;
  const ratio = Math.min(Math.max((datum.value - min) / (max - min), 0), 1);
  const startAngle = Math.PI;
  const endAngle = Math.PI * 2;
  const valueEnd = startAngle + Math.PI * ratio;
  const targetRatio = Number.isFinite(spec.targetValue) ? Math.min(Math.max(((spec.targetValue as number) - min) / (max - min), 0), 1) : null;
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, gauge chart, ${formatChartValue(datum.value, spec.valuePrefix, spec.valueSuffix)}`}>
      <path d={arcPath(320, 222, 132, startAngle, endAngle)} fill="none" stroke={palette.grid} strokeWidth="30" strokeLinecap="round" />
      {ratio > 0 ? <path d={arcPath(320, 222, 132, startAngle, valueEnd)} fill="none" stroke={palette.series[0]} strokeWidth="30" strokeLinecap="round" /> : null}
      {targetRatio !== null ? (() => { const inner = polarPoint(320, 222, 108, startAngle + Math.PI * targetRatio); const outer = polarPoint(320, 222, 153, startAngle + Math.PI * targetRatio); return <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={palette.foreground} strokeWidth="3" />; })() : null}
      <text x="320" y="210" textAnchor="middle" fontSize="38" fontWeight="700" fill={palette.foreground}>{formatChartValue(datum.value, spec.valuePrefix, spec.valueSuffix)}</text>
      <text x="320" y="234" textAnchor="middle" fontSize="12" fill={palette.muted}>{datum.label}</text>
      <text x="175" y="252" textAnchor="middle" fontSize="11" fill={palette.muted}>{formatChartValue(min, spec.valuePrefix, spec.valueSuffix)}</text>
      <text x="465" y="252" textAnchor="middle" fontSize="11" fill={palette.muted}>{formatChartValue(max, spec.valuePrefix, spec.valueSuffix)}</text>
    </svg>
  );
}

export function CandlestickChart({ spec, palette }: AdvancedChartProps) {
  const data = finiteCandlestickData(spec.data);
  if (data.length === 0) return <EmptyChart spec={spec} palette={palette} />;
  const domain = numericDomain(data.flatMap((datum) => [datum.low, datum.high]));
  const band = (PLOT.right - PLOT.left) / data.length;
  const bodyWidth = Math.max(3, Math.min(24, band * 0.55));
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, candlestick chart`}>
      {domain.ticks.map((tick) => { const y = scaleLinear(tick, domain, PLOT.bottom, PLOT.top); return <g key={tick}><line x1={PLOT.left} y1={y} x2={PLOT.right} y2={y} stroke={palette.grid} /><text x={PLOT.left - 9} y={y + 4} textAnchor="end" fontSize="11" fill={palette.muted}>{formatChartValue(tick, spec.valuePrefix, spec.valueSuffix)}</text></g>; })}
      {data.map((datum, index) => {
        const x = PLOT.left + band * (index + 0.5);
        const highY = scaleLinear(datum.high, domain, PLOT.bottom, PLOT.top);
        const lowY = scaleLinear(datum.low, domain, PLOT.bottom, PLOT.top);
        const openY = scaleLinear(datum.open, domain, PLOT.bottom, PLOT.top);
        const closeY = scaleLinear(datum.close, domain, PLOT.bottom, PLOT.top);
        const rising = datum.close >= datum.open;
        const color = rising ? palette.series[2 % palette.series.length] : palette.series[1 % palette.series.length];
        return <g key={`${datum.label}-${index}`}><line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth="2" /><rect x={x - bodyWidth / 2} y={Math.min(openY, closeY)} width={bodyWidth} height={Math.max(Math.abs(openY - closeY), 2)} fill={rising ? palette.surface : color} stroke={color} strokeWidth="2" /><text x={x} y={PLOT.bottom + 20} textAnchor="middle" fontSize="10" fill={palette.muted}>{datum.label.length > 8 ? `${datum.label.slice(0, 7)}…` : datum.label}</text></g>;
      })}
      {spec.xLabel ? <text x={(PLOT.left + PLOT.right) / 2} y={HEIGHT - 5} textAnchor="middle" fontSize="11" fill={palette.muted}>{spec.xLabel}</text> : null}
      {spec.yLabel ? <text x="12" y={(PLOT.top + PLOT.bottom) / 2} textAnchor="middle" fontSize="11" fill={palette.muted} transform={`rotate(-90 12 ${(PLOT.top + PLOT.bottom) / 2})`}>{spec.yLabel}</text> : null}
    </svg>
  );
}
