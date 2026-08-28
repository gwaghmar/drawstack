"use client";

import { useId, useMemo, type CSSProperties, type MouseEvent } from "react";
import { layoutGraph } from "@/lib/engine-v2/graph/layout";
import type {
  GraphDocument,
  GraphLayoutOptions,
  GraphPoint,
  LayoutGraph,
  LayoutGraphEdge,
  LayoutGraphNode,
} from "@/lib/engine-v2/graph/types";

export type GraphPalette = {
  background: string;
  surface: string;
  surfaceMuted: string;
  ink: string;
  quiet: string;
  rule: string;
  accent: string;
  positive: string;
  warning: string;
};

export type GraphRendererProps = {
  graph: GraphDocument | LayoutGraph;
  layout?: GraphLayoutOptions;
  palette?: Partial<GraphPalette>;
  className?: string;
  style?: CSSProperties;
  selectedNodeId?: string;
  onSelectNode?: (id: string) => void;
  title?: string;
};

const DEFAULT_PALETTE: GraphPalette = {
  background: "#F7F8F4",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF1EB",
  ink: "#15171A",
  quiet: "#667067",
  rule: "#A9B1A8",
  accent: "#3157F6",
  positive: "#1D8C65",
  warning: "#DA542F",
};

function isLayoutGraph(graph: GraphDocument | LayoutGraph): graph is LayoutGraph {
  return "width" in graph && "height" in graph && graph.nodes.every((node) => "x" in node);
}

function pointsAttribute(points: GraphPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function labelLines(label: string, maxCharacters = 24): string[] {
  const words = label.trim().split(/\s+/);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1);
    if (!current || current.length + word.length + 1 > maxCharacters) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`;
  }
  return lines.slice(0, 3);
}

function CenteredLabel({ node, color }: { node: LayoutGraphNode; color: string }) {
  const lines = labelLines(node.label, Math.max(14, Math.floor(node.width / 8)));
  const subtitleOffset = node.subtitle ? 9 : 0;
  const startY = node.y + node.height / 2 - ((lines.length - 1) * 9) - subtitleOffset;
  return (
    <text x={node.x + node.width / 2} y={startY} textAnchor="middle" fill={color} fontFamily="ui-sans-serif, system-ui, sans-serif">
      {lines.map((line, index) => (
        <tspan key={`${line}-${index}`} x={node.x + node.width / 2} dy={index ? 18 : 0} fontSize="14" fontWeight="650">{line}</tspan>
      ))}
      {node.subtitle ? <tspan x={node.x + node.width / 2} dy="19" fontSize="10.5" fontWeight="500" fill="#667067">{node.subtitle}</tspan> : null}
    </text>
  );
}

function EntityNode({ node, palette }: { node: LayoutGraphNode; palette: GraphPalette }) {
  const headerHeight = 44;
  return (
    <>
      <rect x={node.x} y={node.y} width={node.width} height={node.height} rx="8" fill={palette.surface} stroke={palette.ink} strokeWidth="1.5" />
      <path d={`M ${node.x} ${node.y + headerHeight} H ${node.x + node.width}`} stroke={palette.ink} strokeWidth="1.5" />
      <text x={node.x + 14} y={node.y + 27} fill={palette.ink} fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="14" fontWeight="700">{node.label}</text>
      {(node.fields ?? []).map((field, index) => {
        const y = node.y + headerHeight + 18 + index * 26;
        const key = field.key === "primary" ? "PK" : field.key === "foreign" ? "FK" : "";
        return (
          <g key={`${field.name}-${index}`}>
            {key ? <text x={node.x + 14} y={y} fill={field.key === "primary" ? palette.accent : palette.quiet} fontFamily="ui-monospace, SFMono-Regular, monospace" fontSize="8.5" fontWeight="800">{key}</text> : null}
            <text x={node.x + (key ? 40 : 14)} y={y} fill={palette.ink} fontFamily="ui-monospace, SFMono-Regular, monospace" fontSize="10.5">{field.name}</text>
            {field.type ? <text x={node.x + node.width - 14} y={y} textAnchor="end" fill={palette.quiet} fontFamily="ui-monospace, SFMono-Regular, monospace" fontSize="9.5">{field.type}</text> : null}
          </g>
        );
      })}
    </>
  );
}

function DatabaseNode({ node, palette }: { node: LayoutGraphNode; palette: GraphPalette }) {
  const cap = 13;
  return (
    <>
      <path d={`M ${node.x} ${node.y + cap} V ${node.y + node.height - cap} C ${node.x} ${node.y + node.height + 3}, ${node.x + node.width} ${node.y + node.height + 3}, ${node.x + node.width} ${node.y + node.height - cap} V ${node.y + cap}`} fill={palette.surface} stroke={palette.ink} strokeWidth="1.5" />
      <ellipse cx={node.x + node.width / 2} cy={node.y + cap} rx={node.width / 2} ry={cap} fill={palette.surfaceMuted} stroke={palette.ink} strokeWidth="1.5" />
      <path d={`M ${node.x} ${node.y + node.height - cap} C ${node.x} ${node.y + node.height + 3}, ${node.x + node.width} ${node.y + node.height + 3}, ${node.x + node.width} ${node.y + node.height - cap}`} fill="none" stroke={palette.ink} strokeWidth="1.5" />
      <CenteredLabel node={{ ...node, y: node.y + 7, height: node.height - 7 }} color={palette.ink} />
    </>
  );
}

function PersonNode({ node, palette }: { node: LayoutGraphNode; palette: GraphPalette }) {
  const iconX = node.x + 31;
  const centerY = node.y + node.height / 2;
  return (
    <>
      <rect x={node.x} y={node.y} width={node.width} height={node.height} rx="38" fill={palette.surface} stroke={palette.ink} strokeWidth="1.5" />
      <circle cx={iconX} cy={centerY - 8} r="7" fill={palette.surfaceMuted} stroke={palette.ink} strokeWidth="1.3" />
      <path d={`M ${iconX - 12} ${centerY + 13} C ${iconX - 11} ${centerY + 1}, ${iconX + 11} ${centerY + 1}, ${iconX + 12} ${centerY + 13}`} fill={palette.surfaceMuted} stroke={palette.ink} strokeWidth="1.3" />
      <text x={node.x + 56} y={centerY - (node.subtitle ? 3 : -5)} fill={palette.ink} fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="14" fontWeight="650">{node.label}</text>
      {node.subtitle ? <text x={node.x + 56} y={centerY + 15} fill={palette.quiet} fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="10.5">{node.subtitle}</text> : null}
    </>
  );
}

function GraphNodeShape({ node, palette, selected }: { node: LayoutGraphNode; palette: GraphPalette; selected: boolean }) {
  const fill = node.tone === "accent" ? "#E9EDFF" : node.tone === "positive" ? "#E6F4EE" : node.tone === "warning" ? "#FFF0EA" : palette.surface;
  const stroke = selected ? palette.accent : node.kind === "service" ? palette.accent : palette.ink;
  let content;
  if (node.kind === "entity") content = <EntityNode node={node} palette={palette} />;
  else if (node.kind === "database") content = <DatabaseNode node={node} palette={palette} />;
  else if (node.kind === "person") content = <PersonNode node={node} palette={palette} />;
  else if (node.kind === "decision") {
    const points = `${node.x + node.width / 2},${node.y} ${node.x + node.width},${node.y + node.height / 2} ${node.x + node.width / 2},${node.y + node.height} ${node.x},${node.y + node.height / 2}`;
    content = <><polygon points={points} fill={fill} stroke={stroke} strokeWidth={selected ? 2.5 : 1.5} /><CenteredLabel node={node} color={palette.ink} /></>;
  } else {
    const radius = node.kind === "process" ? 12 : node.kind === "service" ? 20 : 7;
    content = <><rect x={node.x} y={node.y} width={node.width} height={node.height} rx={radius} fill={fill} stroke={stroke} strokeWidth={selected ? 2.5 : 1.5} /><CenteredLabel node={node} color={palette.ink} /></>;
  }
  return <>{content}{selected ? <rect x={node.x - 4} y={node.y - 4} width={node.width + 8} height={node.height + 8} rx="11" fill="none" stroke={palette.accent} strokeWidth="1" strokeDasharray="4 4" /> : null}</>;
}

function EdgeLabel({ text, point, palette }: { text: string | undefined; point: GraphPoint | undefined; palette: GraphPalette }) {
  if (!text || !point) return null;
  const width = Math.max(22, text.length * 6.5 + 12);
  return (
    <g>
      <rect x={point.x - width / 2} y={point.y - 9} width={width} height="18" rx="5" fill={palette.background} stroke={palette.rule} strokeWidth="0.75" />
      <text x={point.x} y={point.y + 3.5} textAnchor="middle" fill={palette.ink} fontFamily="ui-monospace, SFMono-Regular, monospace" fontSize="9.5" fontWeight="650">{text}</text>
    </g>
  );
}

function Edge({ edge, markerId, palette }: { edge: LayoutGraphEdge; markerId: string; palette: GraphPalette }) {
  const dashed = edge.kind === "dependency";
  const markerEnd = edge.kind === "association" ? undefined : `url(#${markerId})`;
  return (
    <g>
      <polyline points={pointsAttribute(edge.points)} fill="none" stroke={edge.kind === "data" ? palette.accent : palette.rule} strokeWidth={edge.kind === "data" ? 2 : 1.5} strokeDasharray={dashed ? "6 5" : undefined} markerEnd={markerEnd} strokeLinejoin="round" />
      <EdgeLabel text={edge.label} point={edge.labelPoint} palette={palette} />
      <EdgeLabel text={edge.sourceLabel} point={edge.sourceLabelPoint} palette={palette} />
      <EdgeLabel text={edge.targetLabel} point={edge.targetLabelPoint} palette={palette} />
    </g>
  );
}

function groupBounds(graph: LayoutGraph) {
  const groups = new Map<string, LayoutGraphNode[]>();
  for (const node of graph.nodes) {
    if (!node.group) continue;
    const members = groups.get(node.group) ?? [];
    members.push(node);
    groups.set(node.group, members);
  }
  return [...groups.entries()].map(([label, nodes]) => ({
    label,
    x: Math.min(...nodes.map((node) => node.x)) - 18,
    y: Math.min(...nodes.map((node) => node.y)) - 30,
    width: Math.max(...nodes.map((node) => node.x + node.width)) - Math.min(...nodes.map((node) => node.x)) + 36,
    height: Math.max(...nodes.map((node) => node.y + node.height)) - Math.min(...nodes.map((node) => node.y)) + 48,
  }));
}

export function GraphRenderer({ graph, layout, palette: paletteOverrides, className, style, selectedNodeId, onSelectNode, title }: GraphRendererProps) {
  const rendered = useMemo(() => isLayoutGraph(graph) ? graph : layoutGraph(graph, layout), [graph, layout]);
  const palette = { ...DEFAULT_PALETTE, ...paletteOverrides };
  const rawId = useId();
  const markerId = `graph-arrow-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const groups = groupBounds(rendered);
  const selectNode = (event: MouseEvent<SVGGElement>, id: string) => {
    event.stopPropagation();
    onSelectNode?.(id);
  };

  return (
    <svg
      viewBox={`0 0 ${rendered.width} ${rendered.height}`}
      width={rendered.width}
      height={rendered.height}
      className={className}
      style={{ display: "block", width: "100%", height: "auto", background: palette.background, ...style }}
      role="img"
      aria-label={title ?? rendered.name}
      data-graph-engine="deterministic-v2"
    >
      <title>{title ?? rendered.name}</title>
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 1 1 L 9 5 L 1 9 z" fill={palette.rule} />
        </marker>
      </defs>
      {groups.map((group) => (
        <g key={group.label}>
          <rect x={group.x} y={group.y} width={group.width} height={group.height} rx="14" fill={palette.surfaceMuted} fillOpacity="0.55" stroke={palette.rule} strokeWidth="1" strokeDasharray="5 5" />
          <text x={group.x + 12} y={group.y + 17} fill={palette.quiet} fontFamily="ui-monospace, SFMono-Regular, monospace" fontSize="9" fontWeight="750" letterSpacing="1.2">{group.label.toUpperCase()}</text>
        </g>
      ))}
      {rendered.edges.map((edge) => <Edge key={edge.id} edge={edge} markerId={markerId} palette={palette} />)}
      {rendered.nodes.map((node) => (
        <g
          key={node.id}
          role={onSelectNode ? "button" : undefined}
          tabIndex={onSelectNode ? 0 : undefined}
          aria-label={`${node.kind}: ${node.label}`}
          data-graph-node-id={node.id}
          onClick={onSelectNode ? (event) => selectNode(event, node.id) : undefined}
          onKeyDown={onSelectNode ? (event) => {
            if (event.key === "Enter" || event.key === " ") onSelectNode(node.id);
          } : undefined}
          style={{ cursor: onSelectNode ? "pointer" : undefined, outline: "none" }}
        >
          <GraphNodeShape node={node} palette={palette} selected={selectedNodeId === node.id} />
        </g>
      ))}
    </svg>
  );
}
