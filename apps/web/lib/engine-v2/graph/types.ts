export type GraphDirection = "TB" | "LR";

export type GraphNodeKind =
  | "process"
  | "decision"
  | "entity"
  | "database"
  | "person"
  | "service"
  | "system";

export type GraphEdgeKind =
  | "flow"
  | "association"
  | "dependency"
  | "data"
  | "reports-to";

export type GraphField = {
  name: string;
  type?: string;
  key?: "primary" | "foreign";
};

export type GraphNode = {
  id: string;
  label: string;
  kind: GraphNodeKind;
  subtitle?: string;
  fields?: GraphField[];
  group?: string;
  width?: number;
  height?: number;
  tone?: "neutral" | "accent" | "positive" | "warning";
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  kind?: GraphEdgeKind;
  label?: string;
  sourceLabel?: string;
  targetLabel?: string;
};

export type GraphDocument = {
  name: string;
  direction?: GraphDirection;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type GraphLayoutOptions = {
  direction?: GraphDirection;
  layerGap?: number;
  nodeGap?: number;
  padding?: number;
};

export type GraphPoint = { x: number; y: number };

export type LayoutGraphNode = GraphNode & {
  x: number;
  y: number;
  width: number;
  height: number;
  rank: number;
};

export type LayoutGraphEdge = GraphEdge & {
  kind: GraphEdgeKind;
  points: GraphPoint[];
  labelPoint?: GraphPoint;
  sourceLabelPoint?: GraphPoint;
  targetLabelPoint?: GraphPoint;
};

export type LayoutGraph = {
  name: string;
  direction: GraphDirection;
  width: number;
  height: number;
  nodes: LayoutGraphNode[];
  edges: LayoutGraphEdge[];
  warnings: string[];
};
