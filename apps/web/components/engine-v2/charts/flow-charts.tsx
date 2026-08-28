import {
  finiteCartesianData,
  finiteSankeyData,
  formatChartValue,
  layoutSankey,
  layoutWaterfall,
  scaleLinear,
} from "@/lib/engine-v2/chart-layout";
import type { DeterministicChartPalette, DeterministicChartSpec } from "@/lib/engine-v2/chart-types";

type FlowChartProps = {
  spec: DeterministicChartSpec;
  palette: DeterministicChartPalette;
};

const VIEWBOX = { width: 640, height: 330 };
const PLOT = { left: 62, top: 24, right: 616, bottom: 270 };

function EmptyFlowChart({ spec, palette, message }: FlowChartProps & { message?: string }) {
  return <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm" style={{ borderColor: palette.grid, color: palette.muted }} role="img" aria-label={`${spec.title}. No chart data.`}>{message ?? spec.emptyMessage ?? "Add data to render this chart."}</div>;
}

export function SankeyChart({ spec, palette }: FlowChartProps) {
  const data = finiteSankeyData(spec.data);
  const layout = layoutSankey(data, PLOT.right - PLOT.left, PLOT.bottom - PLOT.top);
  if (!layout) return <EmptyFlowChart spec={spec} palette={palette} message={data.length ? "Sankey flows must not contain cycles." : undefined} />;
  const maxLayer = Math.max(...layout.nodes.map((node) => node.layer));
  return (
    <svg viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, sankey chart`}>
      <g transform={`translate(${PLOT.left} ${PLOT.top})`}>
        {layout.links.map((link, index) => <path key={`${link.source}-${link.target}-${index}`} d={link.path} fill="none" stroke={palette.series[link.colorIndex % palette.series.length]} strokeWidth={link.width} strokeOpacity="0.3"><title>{link.source} to {link.target}: {formatChartValue(link.value, spec.valuePrefix, spec.valueSuffix)}</title></path>)}
        {layout.nodes.map((node) => {
          const color = palette.series[node.colorIndex % palette.series.length];
          const finalLayer = node.layer === maxLayer;
          return <g key={node.id}><rect x={node.x} y={node.y} width={node.width} height={node.height} rx="2" fill={color} /><text x={finalLayer ? node.x - 7 : node.x + node.width + 7} y={node.y + node.height / 2 + 4} textAnchor={finalLayer ? "end" : "start"} fontSize="11" fontWeight="600" fill={palette.foreground}>{node.id.length > 18 ? `${node.id.slice(0, 17)}…` : node.id}</text></g>;
        })}
      </g>
    </svg>
  );
}

export function WaterfallChart({ spec, palette }: FlowChartProps) {
  const data = finiteCartesianData(spec.data);
  if (!data.length) return <EmptyFlowChart spec={spec} palette={palette} />;
  const { steps, domain } = layoutWaterfall(data);
  const band = (PLOT.right - PLOT.left) / steps.length;
  const barWidth = Math.max(3, band * 0.64);
  const positive = palette.series[2 % palette.series.length];
  const negative = palette.series[1 % palette.series.length];
  return (
    <svg viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, waterfall chart`}>
      {domain.ticks.map((tick) => { const y = scaleLinear(tick, domain, PLOT.bottom, PLOT.top); return <g key={tick}><line x1={PLOT.left} y1={y} x2={PLOT.right} y2={y} stroke={palette.grid} /><text x={PLOT.left - 9} y={y + 4} textAnchor="end" fontSize="11" fill={palette.muted}>{formatChartValue(tick, spec.valuePrefix, spec.valueSuffix)}</text></g>; })}
      {steps.map((step, index) => {
        const x = PLOT.left + band * index + (band - barWidth) / 2;
        const startY = scaleLinear(step.start, domain, PLOT.bottom, PLOT.top);
        const endY = scaleLinear(step.end, domain, PLOT.bottom, PLOT.top);
        const color = step.value >= 0 ? positive : negative;
        const nextX = PLOT.left + band * (index + 1) + (band - barWidth) / 2;
        return <g key={`${step.label}-${index}`}>{index < steps.length - 1 ? <line x1={x + barWidth} y1={endY} x2={nextX} y2={endY} stroke={palette.muted} strokeDasharray="3 3" /> : null}<rect x={x} y={Math.min(startY, endY)} width={barWidth} height={Math.max(Math.abs(startY - endY), 1)} rx="2" fill={color} />{spec.showValues ? <text x={x + barWidth / 2} y={step.value >= 0 ? Math.min(startY, endY) - 6 : Math.max(startY, endY) + 13} textAnchor="middle" fontSize="10" fill={palette.foreground}>{formatChartValue(step.value, spec.valuePrefix, spec.valueSuffix)}</text> : null}<text x={x + barWidth / 2} y={PLOT.bottom + 20} textAnchor="middle" fontSize="10" fill={palette.muted}>{step.label.length > 10 ? `${step.label.slice(0, 9)}…` : step.label}</text></g>;
      })}
    </svg>
  );
}
