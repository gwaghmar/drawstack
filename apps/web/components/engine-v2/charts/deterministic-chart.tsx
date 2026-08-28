import { useId } from "react";
import {
  areaPath,
  finiteCartesianData,
  finiteScatterData,
  formatChartValue,
  linePath,
  numericDomain,
  orderedUnique,
  scaleLinear,
  stackCartesianData,
  type NumericDomain,
} from "@/lib/engine-v2/chart-layout";
import {
  DEFAULT_CHART_PALETTE,
  type DeterministicChartPalette,
  type DeterministicChartSpec,
} from "@/lib/engine-v2/chart-types";

const VIEWBOX = { width: 640, height: 330 };
const PLOT = { left: 62, top: 24, right: 616, bottom: 270 };

type ChartProps = {
  spec: DeterministicChartSpec;
  className?: string;
};

function paletteFor(spec: DeterministicChartSpec): DeterministicChartPalette {
  return {
    ...DEFAULT_CHART_PALETTE,
    ...spec.palette,
    series: spec.palette?.series?.length ? spec.palette.series : DEFAULT_CHART_PALETTE.series,
  };
}

function seriesColor(series: string, allSeries: string[], palette: DeterministicChartPalette): string {
  return palette.series[Math.max(allSeries.indexOf(series), 0) % palette.series.length];
}

function AxisGrid({ domain, palette, spec }: { domain: NumericDomain; palette: DeterministicChartPalette; spec: DeterministicChartSpec }) {
  return (
    <g aria-hidden="true">
      {domain.ticks.map((tick) => {
        const y = scaleLinear(tick, domain, PLOT.bottom, PLOT.top);
        return (
          <g key={tick}>
            <line x1={PLOT.left} y1={y} x2={PLOT.right} y2={y} stroke={palette.grid} strokeWidth="1" />
            <text x={PLOT.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill={palette.muted}>
              {formatChartValue(tick, spec.valuePrefix, spec.valueSuffix)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function CategoryLabels({ labels, palette }: { labels: string[]; palette: DeterministicChartPalette }) {
  const band = (PLOT.right - PLOT.left) / Math.max(labels.length, 1);
  return (
    <g aria-hidden="true">
      {labels.map((label, index) => (
        <text
          key={`${label}-${index}`}
          x={PLOT.left + band * (index + 0.5)}
          y={PLOT.bottom + 21}
          textAnchor="middle"
          fontSize="11"
          fill={palette.muted}
        >
          {truncate(label, Math.max(5, Math.floor(64 / Math.max(labels.length, 1))))}
        </text>
      ))}
    </g>
  );
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, Math.max(limit - 1, 1))}…`;
}

function Legend({ series, palette }: { series: string[]; palette: DeterministicChartPalette }) {
  if (series.length < 2) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-label="Chart legend">
      {series.map((name, index) => (
        <span key={name} className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: palette.muted }}>
          <span className="h-2 w-2 rounded-sm" style={{ background: palette.series[index % palette.series.length] }} />
          {name}
        </span>
      ))}
    </div>
  );
}

function EmptyChart({ spec, palette }: { spec: DeterministicChartSpec; palette: DeterministicChartPalette }) {
  return (
    <div
      className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm"
      style={{ borderColor: palette.grid, color: palette.muted }}
      role="img"
      aria-label={`${spec.title}. No chart data.`}
    >
      {spec.emptyMessage ?? "Add data to render this chart."}
    </div>
  );
}

function CartesianChart({ spec, palette }: { spec: DeterministicChartSpec; palette: DeterministicChartPalette }) {
  const data = finiteCartesianData(spec.data);
  if (data.length === 0) return <EmptyChart spec={spec} palette={palette} />;
  if (spec.type === "stacked-bar") return <StackedBarChart spec={spec} palette={palette} />;

  const labels = orderedUnique(data.map((datum) => datum.label));
  const series = orderedUnique(data.map((datum) => datum.series?.trim() || "Value"));
  const domain = numericDomain(data.map((datum) => datum.value), { includeZero: spec.type === "bar" });
  const band = (PLOT.right - PLOT.left) / Math.max(labels.length, 1);
  const zeroY = scaleLinear(0, domain, PLOT.bottom, PLOT.top);

  return (
    <>
      <svg viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, ${spec.type} chart`}>
        <AxisGrid domain={domain} palette={palette} spec={spec} />
        <CategoryLabels labels={labels} palette={palette} />
        {spec.type === "bar" ? data.map((datum, index) => {
          const labelIndex = labels.indexOf(datum.label);
          const matchingSeries = series.length;
          const groupWidth = band * 0.72;
          const barWidth = Math.max(2, groupWidth / matchingSeries);
          const seriesName = datum.series?.trim() || "Value";
          const seriesIndex = series.indexOf(seriesName);
          const x = PLOT.left + labelIndex * band + (band - groupWidth) / 2 + seriesIndex * barWidth;
          const valueY = scaleLinear(datum.value, domain, PLOT.bottom, PLOT.top);
          const y = Math.min(valueY, zeroY);
          const height = Math.max(Math.abs(zeroY - valueY), 1);
          return (
            <g key={`${datum.label}-${seriesName}-${index}`}>
              <rect x={x} y={y} width={Math.max(barWidth - 2, 1)} height={height} rx="3" fill={seriesColor(seriesName, series, palette)} />
              {spec.showValues ? <text x={x + barWidth / 2} y={datum.value >= 0 ? y - 6 : y + height + 13} textAnchor="middle" fontSize="10" fill={palette.foreground}>{formatChartValue(datum.value, spec.valuePrefix, spec.valueSuffix)}</text> : null}
            </g>
          );
        }) : series.map((seriesName) => {
          const points = labels.flatMap((label, index) => {
            const datum = data.find((item) => item.label === label && (item.series?.trim() || "Value") === seriesName);
            return datum ? [{ x: PLOT.left + band * (index + 0.5), y: scaleLinear(datum.value, domain, PLOT.bottom, PLOT.top), datum }] : [];
          });
          const color = seriesColor(seriesName, series, palette);
          return (
            <g key={seriesName}>
              {spec.type === "area" && points.length > 0 ? <path d={areaPath(points, Math.min(Math.max(zeroY, PLOT.top), PLOT.bottom))} fill={color} fillOpacity="0.16" /> : null}
              <path d={linePath(points)} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              {points.map(({ x, y, datum }) => <circle key={`${datum.label}-${seriesName}`} cx={x} cy={y} r="4" fill={palette.surface} stroke={color} strokeWidth="2.5" />)}
            </g>
          );
        })}
        {spec.xLabel ? <text x={(PLOT.left + PLOT.right) / 2} y={VIEWBOX.height - 6} textAnchor="middle" fontSize="11" fill={palette.muted}>{spec.xLabel}</text> : null}
        {spec.yLabel ? <text x="12" y={(PLOT.top + PLOT.bottom) / 2} textAnchor="middle" fontSize="11" fill={palette.muted} transform={`rotate(-90 12 ${(PLOT.top + PLOT.bottom) / 2})`}>{spec.yLabel}</text> : null}
      </svg>
      {spec.showLegend !== false ? <Legend series={series} palette={palette} /> : null}
    </>
  );
}

function StackedBarChart({ spec, palette }: { spec: DeterministicChartSpec; palette: DeterministicChartPalette }) {
  const stack = stackCartesianData(finiteCartesianData(spec.data));
  if (stack.labels.length === 0) return <EmptyChart spec={spec} palette={palette} />;
  const band = (PLOT.right - PLOT.left) / stack.labels.length;
  const barWidth = band * 0.66;
  return (
    <>
      <svg viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, stacked bar chart`}>
        <AxisGrid domain={stack.domain} palette={palette} spec={spec} />
        <CategoryLabels labels={stack.labels} palette={palette} />
        {stack.segments.map((segment, index) => {
          const x = PLOT.left + stack.labels.indexOf(segment.label) * band + (band - barWidth) / 2;
          const startY = scaleLinear(segment.start, stack.domain, PLOT.bottom, PLOT.top);
          const endY = scaleLinear(segment.end, stack.domain, PLOT.bottom, PLOT.top);
          const height = Math.max(Math.abs(startY - endY), segment.value === 0 ? 0 : 1);
          return (
            <g key={`${segment.label}-${segment.series}-${index}`}>
              <rect x={x} y={Math.min(startY, endY)} width={barWidth} height={height} fill={seriesColor(segment.series, stack.series, palette)} />
              {spec.showValues && height >= 18 ? <text x={x + barWidth / 2} y={Math.min(startY, endY) + height / 2 + 4} textAnchor="middle" fontSize="10" fontWeight="600" fill={palette.surface}>{formatChartValue(segment.value, spec.valuePrefix, spec.valueSuffix)}</text> : null}
            </g>
          );
        })}
        {spec.xLabel ? <text x={(PLOT.left + PLOT.right) / 2} y={VIEWBOX.height - 6} textAnchor="middle" fontSize="11" fill={palette.muted}>{spec.xLabel}</text> : null}
        {spec.yLabel ? <text x="12" y={(PLOT.top + PLOT.bottom) / 2} textAnchor="middle" fontSize="11" fill={palette.muted} transform={`rotate(-90 12 ${(PLOT.top + PLOT.bottom) / 2})`}>{spec.yLabel}</text> : null}
      </svg>
      {spec.showLegend !== false ? <Legend series={stack.series} palette={palette} /> : null}
    </>
  );
}

function DonutChart({ spec, palette }: { spec: DeterministicChartSpec; palette: DeterministicChartPalette }) {
  const data = finiteCartesianData(spec.data).filter((datum) => datum.value > 0);
  const total = data.reduce((sum, datum) => sum + datum.value, 0);
  if (data.length === 0 || total <= 0) return <EmptyChart spec={spec} palette={palette} />;
  const radius = 88;
  const circumference = Math.PI * 2 * radius;
  let offset = 0;
  return (
    <div className="grid min-h-[260px] grid-cols-[minmax(180px,1fr)_minmax(140px,0.75fr)] items-center gap-4">
      <svg viewBox="0 0 280 280" className="block h-auto w-full" role="img" aria-label={`${spec.title}, donut chart`}>
        <g transform="rotate(-90 140 140)">
          {data.map((datum, index) => {
            const length = (datum.value / total) * circumference;
            const dashOffset = -offset;
            offset += length;
            return <circle key={`${datum.label}-${index}`} cx="140" cy="140" r={radius} fill="none" stroke={palette.series[index % palette.series.length]} strokeWidth="42" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={dashOffset} />;
          })}
        </g>
        <text x="140" y="135" textAnchor="middle" fontSize="12" fill={palette.muted}>Total</text>
        <text x="140" y="158" textAnchor="middle" fontSize="20" fontWeight="700" fill={palette.foreground}>{formatChartValue(total, spec.valuePrefix, spec.valueSuffix)}</text>
      </svg>
      <div className="space-y-2">
        {data.map((datum, index) => (
          <div key={`${datum.label}-${index}`} className="flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex min-w-0 items-center gap-2" style={{ color: palette.muted }}><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: palette.series[index % palette.series.length] }} /><span className="truncate">{datum.label}</span></span>
            <span className="font-semibold tabular-nums" style={{ color: palette.foreground }}>{formatChartValue(datum.value, spec.valuePrefix, spec.valueSuffix)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScatterChart({ spec, palette }: { spec: DeterministicChartSpec; palette: DeterministicChartPalette }) {
  const data = finiteScatterData(spec.data);
  if (data.length === 0) return <EmptyChart spec={spec} palette={palette} />;
  const xDomain = numericDomain(data.map((datum) => datum.x));
  const yDomain = numericDomain(data.map((datum) => datum.y));
  const series = orderedUnique(data.map((datum) => datum.series?.trim() || "Value"));
  return (
    <>
      <svg viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, scatter chart`}>
        <AxisGrid domain={yDomain} palette={palette} spec={spec} />
        {xDomain.ticks.map((tick) => <text key={tick} x={scaleLinear(tick, xDomain, PLOT.left, PLOT.right)} y={PLOT.bottom + 21} textAnchor="middle" fontSize="11" fill={palette.muted}>{formatChartValue(tick)}</text>)}
        {data.map((datum, index) => {
          const seriesName = datum.series?.trim() || "Value";
          return <circle key={`${datum.label ?? "point"}-${index}`} cx={scaleLinear(datum.x, xDomain, PLOT.left, PLOT.right)} cy={scaleLinear(datum.y, yDomain, PLOT.bottom, PLOT.top)} r="5.5" fill={seriesColor(seriesName, series, palette)} fillOpacity="0.82"><title>{datum.label ? `${datum.label}: ` : ""}${datum.x}, ${datum.y}</title></circle>;
        })}
        {spec.xLabel ? <text x={(PLOT.left + PLOT.right) / 2} y={VIEWBOX.height - 6} textAnchor="middle" fontSize="11" fill={palette.muted}>{spec.xLabel}</text> : null}
        {spec.yLabel ? <text x="12" y={(PLOT.top + PLOT.bottom) / 2} textAnchor="middle" fontSize="11" fill={palette.muted} transform={`rotate(-90 12 ${(PLOT.top + PLOT.bottom) / 2})`}>{spec.yLabel}</text> : null}
      </svg>
      {spec.showLegend !== false ? <Legend series={series} palette={palette} /> : null}
    </>
  );
}

export function DeterministicChart({ spec, className = "" }: ChartProps) {
  const titleId = useId();
  const palette = paletteFor(spec);
  return (
    <figure className={className} aria-labelledby={titleId}>
      <figcaption id={titleId} className="sr-only">{spec.title}</figcaption>
      {spec.type === "donut" ? <DonutChart spec={spec} palette={palette} /> : spec.type === "scatter" ? <ScatterChart spec={spec} palette={palette} /> : <CartesianChart spec={spec} palette={palette} />}
    </figure>
  );
}
