import type { CSSProperties } from "react";
import type { DeterministicChartDatum, DeterministicChartType } from "./chart-types";
import type { GraphDocument } from "./graph";

export type EngineTokens = {
  colors: Record<string, string>;
  spacing: Record<string, number>;
  radii: Record<string, number>;
};

export type EngineStyle = {
  background?: string;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: CSSProperties["borderStyle"];
  strokeLinecap?: "butt" | "round" | "square";
  strokeLinejoin?: "miter" | "round" | "bevel";
  borderRadius?: number;
  boxShadow?: string;
  objectFit?: CSSProperties["objectFit"];
  objectPosition?: string;
  textAlign?: CSSProperties["textAlign"];
  fontWeight?: CSSProperties["fontWeight"];
  fontStyle?: CSSProperties["fontStyle"];
  textDecoration?: CSSProperties["textDecoration"];
  fontSize?: number;
  fontFamily?: CSSProperties["fontFamily"];
  lineHeight?: number | string;
  letterSpacing?: number | string;
  minHeight?: number;
  width?: number | string;
  flex?: number;
  alignSelf?: CSSProperties["alignSelf"];
  position?: "absolute";
  x?: number;
  y?: number;
  opacity?: number;
};

export type EngineNodeState = {
  visible?: boolean;
  locked?: boolean;
  rotation?: number;
};

export type FrameLayout = {
  mode: "flex" | "grid";
  direction?: "row" | "column";
  gap: number;
  padding: number;
  columns?: number;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
};

export type EngineTextNode = EngineNodeState & {
  id: string;
  name: string;
  type: "text";
  content: string;
  variant: "eyebrow" | "display" | "heading" | "body" | "caption";
  style?: EngineStyle;
};

export type EngineMetricNode = EngineNodeState & {
  id: string;
  name: string;
  type: "metric";
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "positive" | "warning";
  style?: EngineStyle;
};
export type EngineImageNode = EngineNodeState & { id: string; name: string; type: "image"; src: string; alt: string; style?: EngineStyle };
export type EnginePathNode = EngineNodeState & { id: string; name: string; type: "path"; points: Array<{ x: number; y: number }>; lineStyle?: "straight" | "elbow" | "curve"; arrowEnd?: boolean; closed?: boolean; startNodeId?: string; endNodeId?: string; style?: EngineStyle };

export type EngineChartDatum = DeterministicChartDatum;

export type EngineChartNode = EngineNodeState & {
  id: string;
  name: string;
  type: "chart";
  title: string;
  chartType: DeterministicChartType;
  data: EngineChartDatum[];
  valuePrefix?: string;
  valueSuffix?: string;
  style?: EngineStyle;
};

export type EngineGraphNode = EngineNodeState & {
  id: string;
  name: string;
  type: "graph";
  title: string;
  graph: GraphDocument;
  style?: EngineStyle;
};

export type EngineFrameNode = EngineNodeState & {
  id: string;
  name: string;
  type: "frame";
  layout: FrameLayout;
  style?: EngineStyle;
  children: EngineNode[];
};

export type EngineNode =
  | EngineTextNode
  | EngineMetricNode
  | EngineImageNode
  | EnginePathNode
  | EngineChartNode
  | EngineGraphNode
  | EngineFrameNode;

export type EngineDocument = {
  version: 2;
  engine: "dom-css";
  name: string;
  artboard: {
    width: number;
    minHeight: number;
    background: string;
  };
  tokens: EngineTokens;
  children: EngineNode[];
};

export function mapNode(
  nodes: EngineNode[],
  id: string,
  update: (node: EngineNode) => EngineNode,
): EngineNode[] {
  return nodes.map((node) => {
    if (node.id === id) return update(node);
    if (node.type !== "frame") return node;
    return { ...node, children: mapNode(node.children, id, update) };
  });
}

export function findNode(nodes: EngineNode[], id: string): EngineNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.type === "frame") {
      const match = findNode(node.children, id);
      if (match) return match;
    }
  }
  return null;
}

export function resolveToken(value: string | undefined, tokens: EngineTokens): string | undefined {
  if (!value?.startsWith("$")) return value;
  return tokens.colors[value.slice(1)] ?? value;
}

export function nodeStyle(style: EngineStyle | undefined, tokens: EngineTokens): CSSProperties {
  if (!style) return {};
  return {
    background: resolveToken(style.background, tokens),
    color: resolveToken(style.color, tokens),
    borderColor: resolveToken(style.borderColor, tokens),
    borderWidth: style.borderWidth,
    borderStyle: style.borderWidth ? style.borderStyle ?? "solid" : undefined,
    borderRadius: style.borderRadius,
    boxShadow: style.boxShadow,
    objectFit: style.objectFit,
    objectPosition: style.objectPosition,
    textAlign: style.textAlign,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    textDecoration: style.textDecoration,
    fontSize: style.fontSize,
    fontFamily: style.fontFamily,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    minHeight: style.minHeight,
    width: style.width,
    flex: style.flex,
    alignSelf: style.alignSelf,
    position: style.position,
    left: style.position === "absolute" ? style.x : undefined,
    top: style.position === "absolute" ? style.y : undefined,
    opacity: style.opacity,
    transform: undefined,
  };
}

export const ENGINE_V2_SAMPLE: EngineDocument = {
  version: 2,
  engine: "dom-css",
  name: "Revenue operating brief",
  artboard: {
    width: 1080,
    minHeight: 720,
    background: "$paper",
  },
  tokens: {
    colors: {
      ink: "#15171A",
      paper: "#F7F8F4",
      panel: "#FFFFFF",
      rule: "#D7DBD2",
      cobalt: "#3157F6",
      orange: "#FF5D2E",
      lime: "#B7FF4A",
      quiet: "#667067",
    },
    spacing: { xs: 6, sm: 12, md: 20, lg: 32, xl: 48 },
    radii: { tight: 4, panel: 14, pill: 999 },
  },
  children: [
    {
      id: "root",
      name: "Report",
      type: "frame",
      layout: { mode: "flex", direction: "column", gap: 28, padding: 44 },
      style: { background: "$paper", color: "$ink", minHeight: 720 },
      children: [
        {
          id: "header",
          name: "Header",
          type: "frame",
          layout: { mode: "flex", direction: "row", gap: 24, padding: 0, align: "flex-end", justify: "space-between" },
          children: [
            {
              id: "title-stack",
              name: "Title stack",
              type: "frame",
              layout: { mode: "flex", direction: "column", gap: 8, padding: 0 },
              children: [
                { id: "eyebrow", name: "Report label", type: "text", content: "OPERATING BRIEF / AUG 2026", variant: "eyebrow", style: { color: "$cobalt" } },
                { id: "title", name: "Report title", type: "text", content: "Growth without the noise.", variant: "display" },
              ],
            },
            { id: "status", name: "Status", type: "metric", label: "Forecast confidence", value: "87%", detail: "Updated 4 min ago", tone: "positive", style: { width: 220 } },
          ],
        },
        {
          id: "metrics",
          name: "Key metrics",
          type: "frame",
          layout: { mode: "grid", columns: 3, gap: 14, padding: 0 },
          children: [
            { id: "mrr", name: "Monthly revenue", type: "metric", label: "Monthly recurring revenue", value: "$428K", detail: "+18.6% year over year", tone: "positive" },
            { id: "retention", name: "Net retention", type: "metric", label: "Net revenue retention", value: "121%", detail: "+4 points this quarter", tone: "positive" },
            { id: "payback", name: "CAC payback", type: "metric", label: "CAC payback", value: "8.2 mo", detail: "Target is under 9 months", tone: "neutral" },
          ],
        },
        {
          id: "analysis",
          name: "Analysis row",
          type: "frame",
          layout: { mode: "grid", columns: 2, gap: 14, padding: 0 },
          children: [
            {
              id: "revenue-chart",
              name: "Revenue chart",
              type: "chart",
              title: "Revenue trajectory",
              chartType: "line",
              valuePrefix: "$",
              valueSuffix: "K",
              data: [
                { label: "Mar", value: 302 },
                { label: "Apr", value: 326 },
                { label: "May", value: 351 },
                { label: "Jun", value: 369 },
                { label: "Jul", value: 397 },
                { label: "Aug", value: 428 },
              ],
              style: { minHeight: 290 },
            },
            {
              id: "mix-chart",
              name: "Revenue mix",
              type: "chart",
              title: "Revenue mix",
              chartType: "bar",
              valueSuffix: "%",
              data: [
                { label: "Core", value: 58 },
                { label: "Teams", value: 27 },
                { label: "API", value: 15 },
              ],
              style: { minHeight: 290 },
            },
          ],
        },
        {
          id: "growth-system",
          name: "Growth system",
          type: "graph",
          title: "How demand becomes retained revenue",
          graph: {
            name: "Growth system",
            direction: "LR",
            nodes: [
              { id: "demand", label: "Qualified demand", kind: "process", tone: "accent" },
              { id: "activation", label: "Activation", kind: "decision", subtitle: "Value reached?" },
              { id: "revenue", label: "Recurring revenue", kind: "database", tone: "positive" },
              { id: "retention-loop", label: "Retention loop", kind: "service" },
            ],
            edges: [
              { id: "g1", source: "demand", target: "activation", label: "onboard" },
              { id: "g2", source: "activation", target: "revenue", label: "yes" },
              { id: "g3", source: "revenue", target: "retention-loop", kind: "data", label: "usage" },
              { id: "g4", source: "retention-loop", target: "activation", kind: "dependency", label: "improve" },
            ],
          },
          style: { minHeight: 330 },
        },
      ],
    },
  ],
};
