import { formatChartValue, polarPoint } from "@/lib/engine-v2/chart-layout";
import { annularSectorPath, chordGeometry, layoutHierarchy } from "@/lib/engine-v2/hierarchy-layout";
import type { DeterministicChartPalette, DeterministicChartSpec } from "@/lib/engine-v2/chart-types";

type Props = { spec: DeterministicChartSpec; palette: DeterministicChartPalette };
const WIDTH = 640;
const HEIGHT = 330;

function EmptyChart({ spec, palette }: Props) {
  return <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm" style={{ borderColor: palette.grid, color: palette.muted }} role="img" aria-label={`${spec.title}. No chart data.`}>{spec.emptyMessage ?? "Add data to render this chart."}</div>;
}

export function SunburstChart({ spec, palette }: Props) {
  const layout = layoutHierarchy(spec.data);
  if (!layout.segments.length) return <EmptyChart spec={spec} palette={palette} />;
  const ring = 116 / Math.max(layout.maxDepth, 1);
  return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, sunburst chart`}>
    {layout.segments.map((segment, index) => <path key={segment.id} d={annularSectorPath(320, 160, Math.max(2, (segment.depth - 1) * ring), segment.depth * ring, segment.start, segment.end)} fill={palette.series[(segment.depth + index) % palette.series.length]} fillOpacity={0.72 + segment.depth * 0.05} stroke={palette.surface} strokeWidth="2"><title>{segment.id}: {formatChartValue(segment.value, spec.valuePrefix, spec.valueSuffix)}</title></path>)}
  </svg>;
}

export function IcicleChart({ spec, palette }: Props) {
  const layout = layoutHierarchy(spec.data);
  if (!layout.segments.length) return <EmptyChart spec={spec} palette={palette} />;
  const left = 24;
  const width = 592;
  const row = 276 / Math.max(layout.maxDepth, 1);
  return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, icicle chart`}>
    {layout.segments.map((segment, index) => { const x = left + segment.start * width; const w = (segment.end - segment.start) * width; const y = 24 + (segment.depth - 1) * row; return <g key={segment.id}><rect x={x + 1} y={y + 1} width={Math.max(w - 2, 0)} height={Math.max(row - 2, 0)} rx="3" fill={palette.series[(segment.depth + index) % palette.series.length]} fillOpacity="0.78"><title>{segment.id}: {formatChartValue(segment.value, spec.valuePrefix, spec.valueSuffix)}</title></rect>{w > 52 && row > 22 ? <text x={x + 8} y={y + 18} fontSize="10" fontWeight="650" fill={palette.surface}>{segment.label}</text> : null}</g>; })}
  </svg>;
}

export function CirclePackChart({ spec, palette }: Props) {
  const layout = layoutHierarchy(spec.data);
  if (!layout.segments.length) return <EmptyChart spec={spec} palette={palette} />;
  const leaves = layout.segments.filter((segment) => !layout.segments.some((candidate) => candidate.id.startsWith(`${segment.id}/`)));
  return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, circle pack chart`}>
    {leaves.map((segment, index) => { const cellWidth = (segment.end - segment.start) * 560; const radius = Math.max(5, Math.min(cellWidth * 0.46, 112)); const cx = 40 + (segment.start + segment.end) * 280; const cy = 165; return <g key={segment.id}><circle cx={cx} cy={cy} r={radius} fill={palette.series[index % palette.series.length]} fillOpacity="0.72" stroke={palette.surface} strokeWidth="2"><title>{segment.id}: {formatChartValue(segment.value, spec.valuePrefix, spec.valueSuffix)}</title></circle>{radius > 22 ? <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fontWeight="650" fill={palette.surface}>{segment.label.slice(0, Math.max(3, Math.floor(radius / 4)))}</text> : null}</g>; })}
  </svg>;
}

export function ChordChart({ spec, palette }: Props) {
  const layout = chordGeometry(spec.data, 320, 160, 112);
  if (!layout.links.length) return <EmptyChart spec={spec} palette={palette} />;
  return <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label={`${spec.title}, chord chart`}>
    {layout.links.map((link, index) => <path key={`${link.source}-${link.target}-${index}`} d={`M${link.sourcePoint.x},${link.sourcePoint.y} Q320,160 ${link.targetPoint.x},${link.targetPoint.y}`} fill="none" stroke={palette.series[index % palette.series.length]} strokeWidth={Math.max(2, Math.min(18, Math.sqrt(link.value) * 2))} strokeOpacity="0.35"><title>{link.source} to {link.target}: {formatChartValue(link.value, spec.valuePrefix, spec.valueSuffix)}</title></path>)}
    {layout.nodes.map((node, index) => { const middle = (node.start + node.end) / 2; const label = polarPoint(320, 160, 137, middle); return <g key={node.name}><path d={annularSectorPath(320, 160, 116, 130, (node.start + Math.PI / 2) / (Math.PI * 2), (node.end + Math.PI / 2) / (Math.PI * 2))} fill={palette.series[index % palette.series.length]} /><text x={label.x} y={label.y + 4} textAnchor="middle" fontSize="10" fill={palette.foreground}>{node.name}</text></g>; })}
  </svg>;
}
