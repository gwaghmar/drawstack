export type CanvasDocument = {
  version: 1;
  renderMode?: "clean" | "sketchy";
  presentationMode?: boolean;
  shapes: CanvasShape[];
};

export type BaseShape = {
  id: string;
  name?: string;
  role?: string;
  x: number;
  y: number;
  rotation?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDash?: "solid" | "dashed" | "dotted";
  opacity?: number;
  frameId?: string | null;
  parentId?: string | null;
  locked?: boolean;
  onClickNavigateToFrameId?: string;
  text?: {
    content: string;
    fontSize?: number;
    fontFamily?: string;
    align?: "left" | "center" | "right";
    color?: string;
    bold?: boolean;
  };
};

export type RectShape = BaseShape & { type: "rectangle"; width: number; height: number; cornerRadius?: number };
export type EllipseShape = BaseShape & { type: "ellipse"; width: number; height: number };
export type DiamondShape = BaseShape & { type: "diamond"; width: number; height: number };
export type TriangleShape = BaseShape & { type: "triangle"; width: number; height: number };
export type CylinderShape = BaseShape & { type: "cylinder"; width: number; height: number };
export type CloudShape = BaseShape & { type: "cloud"; width: number; height: number };
export type HexagonShape = BaseShape & { type: "hexagon"; width: number; height: number };
export type StarShape = BaseShape & { type: "star"; width: number; height: number };
export type StickyShape = BaseShape & { type: "sticky"; width: number; height: number };
export type TextShape = BaseShape & { type: "text"; width: number; height: number };
export type FrameShape = BaseShape & { type: "frame"; width: number; height: number; name?: string };

export type CardShape = BaseShape & {
  type: "card";
  width: number;
  height: number;
  icon?: string;
  badge?: { text: string; color?: string; bg?: string };
  title: string;
  subtitle?: string;
  metadata?: { label: string; value: string }[];
  cornerRadius?: number;
};

export type TableShape = BaseShape & {
  type: "table";
  width: number;
  height: number;
  tableName: string;
  headerBg?: string;
  columns: { name: string; type: string; isPk?: boolean; isFk?: boolean }[];
  cornerRadius?: number;
};

export type ImageShape = BaseShape & {
  type: "image";
  src: string;
  width: number;
  height: number;
  alt?: string;
  cornerRadius?: number;
  objectFit?: "cover" | "contain" | "fill";
};

export type MetricShape = BaseShape & {
  type: "metric";
  width: number;
  height: number;
  label: string;
  value: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  sparkline?: number[];
  icon?: string;
  cornerRadius?: number;
};

export type DashboardShape = BaseShape & {
  type: "dashboard";
  width: number;
  height: number;
  title: string;
  subtitle?: string;
  badge?: string;
  tabs?: { label: string; active?: boolean }[];
  actions?: { label: string; icon?: string }[];
  highlightBanner?: { text: string; variant?: "coral" | "emerald" | "blue" };
  cornerRadius?: number;
};

export type ChartShape = BaseShape & {
  type: "chart";
  width: number;
  height: number;
  title: string;
  subtitle?: string;
  chartType: "area" | "bar" | "grouped_bar" | "donut" | "horizontal_bar" | "progress_gauge" | "line";
  data?: { label: string; value: number; color?: string; isEstimate?: boolean }[];
  groupedData?: { category: string; series: { name: string; value: number; color?: string; formatted?: string; isEstimate?: boolean }[] }[];
  donutData?: { label: string; value: string; percent: number; color: string }[];
  centerLabel?: { primary: string; secondary?: string };
  progressSegments?: { label: string; value: string; percent: number; color: string }[];
  callouts?: { category: string; text: string; color?: string }[];
  cornerRadius?: number;
};

export type FeedTableShape = BaseShape & {
  type: "feed_table";
  width: number;
  height: number;
  title: string;
  subtitle?: string;
  rows: { date: string; event: string; amount?: string; amountColor?: string }[];
  cornerRadius?: number;
};

export type MindmapShape = BaseShape & {
  type: "mindmap" | "fishbone";
  width: number;
  height: number;
  title?: string;
  steps: {
    number: string;
    title: string;
    subtitle?: string;
    isTerminal?: boolean;
    branches?: { side: "left" | "right"; text: string }[];
    vennNodes?: { label: string; callout?: string }[];
    pills?: string[];
  }[];
  cornerRadius?: number;
};

export type SCurveTimelineShape = BaseShape & {
  type: "scurve_timeline";
  width: number;
  height: number;
  title: string;
  subtitle?: string;
  strokeColor?: string;
  steps: {
    stepNumber: string;
    title: string;
    description: string;
    hubColor?: string;
  }[];
  hasSilhouette?: boolean;
  cornerRadius?: number;
};

export type IsometricBlockShape = BaseShape & {
  type: "isometric_block";
  width: number;
  height: number;
  title: string;
  subtitle?: string;
  baseColor?: string;
  callouts: {
    number: string;
    title: string;
    description: string;
    side?: "left" | "right";
  }[];
  hasSilhouette?: boolean;
  cornerRadius?: number;
};

export type MockupShape = BaseShape & {
  type: "mockup";
  width: number;
  height: number;
  mockupType: "browser" | "macbook" | "mobile";
  title?: string;
  url?: string;
  cornerRadius?: number;
};

export type VennTimelineShape = BaseShape & {
  type: "venn_timeline";
  width: number;
  height: number;
  title?: string;
  nodes: {
    number?: string;
    primaryText: string;
    subText?: string;
    vennLabels?: string[];
    branches?: { text: string; side?: "left" | "right" }[];
    color?: "dark" | "light" | "accent";
  }[];
};

export type TechHudPanelShape = BaseShape & {
  type: "tech_hud_panel";
  width: number;
  height: number;
  title: string;
  gridItems: {
    label: string;
    value?: string;
    barcode?: boolean;
    crosshair?: boolean;
    colSpan?: number;
    rowSpan?: number;
  }[];
};

export type LayeredProcessMapShape = BaseShape & {
  type: "layered_process_map";
  width: number;
  height: number;
  title: string;
  zones: {
    id: string;
    label: string;
    color?: string;
  }[];
  nodes: {
    id: string;
    zoneId: string;
    label: string;
    icon?: "people" | "gear" | "document" | "circle";
  }[];
  connections: {
    from: string;
    to: string;
    color?: string;
    style?: "solid" | "dotted";
  }[];
};

export type PathShape = BaseShape & {
  type: "path";
  points: [number, number][];
};

export type ArrowEndpoint =
  | { x: number; y: number }
  | { shapeId: string; anchor?: "top" | "right" | "bottom" | "left" | "center" | "auto" };

export type ArrowShape = BaseShape & {
  type: "arrow" | "line";
  start: ArrowEndpoint;
  end: ArrowEndpoint;
  label?: string;
  routing?: "straight" | "curved" | "orthogonal";
  arrowStart?: boolean;
  arrowEnd?: boolean;
};

export type CanvasShape =
  | RectShape
  | EllipseShape
  | DiamondShape
  | TriangleShape
  | CylinderShape
  | CloudShape
  | HexagonShape
  | StarShape
  | StickyShape
  | TextShape
  | FrameShape
  | CardShape
  | TableShape
  | ImageShape
  | MetricShape
  | DashboardShape
  | ChartShape
  | FeedTableShape
  | MindmapShape
  | SCurveTimelineShape
  | IsometricBlockShape
  | MockupShape
  | VennTimelineShape
  | TechHudPanelShape
  | LayeredProcessMapShape
  | PathShape
  | ArrowShape;

export function createEmptyDocument(): CanvasDocument {
  return { version: 1, shapes: [] };
}

export function parseFreeformSource(source: string): { doc: CanvasDocument; errors: string[] } {
  if (source.trim() === "") {
    return { doc: createEmptyDocument(), errors: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (e) {
    return { doc: createEmptyDocument(), errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { doc: createEmptyDocument(), errors: ["Document must be a JSON object"] };
  }
  if (!("version" in parsed) || !("shapes" in parsed)) {
    return { doc: createEmptyDocument(), errors: ["Document must have \"version\" and \"shapes\" fields"] };
  }
  if (!Array.isArray((parsed as { shapes: unknown }).shapes)) {
    return { doc: createEmptyDocument(), errors: ["\"shapes\" must be an array"] };
  }

  return { doc: parsed as CanvasDocument, errors: [] };
}

export function serializeFreeformDocument(doc: CanvasDocument): string {
  return JSON.stringify(doc);
}

export function computeDynamicShapeDimensions(
  doc: CanvasDocument,
  shape: CanvasShape
): { x: number; y: number; width: number; height: number } {
  if (shape.type === "card") {
    const card = shape as CardShape;
    const minH = 44 + (card.subtitle ? 24 : 0) + (card.metadata?.length ? card.metadata.length * 24 + 10 : 0) + 16;
    return {
      x: card.x,
      y: card.y,
      width: Math.max(card.width, 240),
      height: Math.max(card.height, minH),
    };
  }

  if (shape.type === "table") {
    const table = shape as TableShape;
    const minH = 38 + table.columns.length * 24 + 16;
    return {
      x: table.x,
      y: table.y,
      width: Math.max(table.width, 240),
      height: Math.max(table.height, minH),
    };
  }

  if (shape.type === "metric") {
    const m = shape as MetricShape;
    return {
      x: m.x,
      y: m.y,
      width: Math.max(m.width, 220),
      height: Math.max(m.height, 110),
    };
  }

  if (shape.type === "frame" || shape.type === "mockup") {
    const children = doc.shapes.filter(
      (s) => s.id !== shape.id && (s.parentId === shape.id || s.frameId === shape.id)
    );
    if (children.length > 0) {
      let minX = shape.x;
      let minY = shape.y;
      let maxX = shape.x + shape.width;
      let maxY = shape.y + shape.height;

      for (const child of children) {
        const cb = computeDynamicShapeDimensions(doc, child);
        minX = Math.min(minX, cb.x - 24);
        minY = Math.min(minY, cb.y - (shape.type === "mockup" ? 48 : 36));
        maxX = Math.max(maxX, cb.x + cb.width + 24);
        maxY = Math.max(maxY, cb.y + cb.height + 24);
      }
      return {
        x: minX,
        y: minY,
        width: Math.max(shape.width, maxX - minX),
        height: Math.max(shape.height, maxY - minY),
      };
    }
  }

  const s = shape as Exclude<CanvasShape, ArrowShape | PathShape>;
  return { x: s.x, y: s.y, width: s.width, height: s.height };
}

export function getShapeBounds(doc: CanvasDocument, shape: CanvasShape): { x: number; y: number; width: number; height: number } {
  if (shape.type === "arrow" || shape.type === "line") {
    const start = resolveArrowEndpoint(doc, shape.start);
    const end = resolveArrowEndpoint(doc, shape.end);
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    return { x: minX, y: minY, width: Math.max(start.x, end.x) - minX, height: Math.max(start.y, end.y) - minY };
  }
  if (shape.type === "path") {
    if (!shape.points || shape.points.length === 0) {
      return { x: shape.x, y: shape.y, width: 0, height: 0 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [px, py] of shape.points) {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
  }

  return computeDynamicShapeDimensions(doc, shape);
}

export function isBoundEndpoint(endpoint: ArrowEndpoint): endpoint is { shapeId: string; anchor?: "top" | "right" | "bottom" | "left" | "center" | "auto" } {
  return "shapeId" in endpoint;
}

export function resolveArrowEndpoint(doc: CanvasDocument, endpoint: ArrowEndpoint): { x: number; y: number; error?: string } {
  if (!isBoundEndpoint(endpoint)) {
    return endpoint as { x: number; y: number };
  }

  const shape = doc.shapes.find((s) => s.id === endpoint.shapeId);
  if (!shape) {
    return { x: 0, y: 0, error: `Arrow endpoint references missing shape "${endpoint.shapeId}"` };
  }

  const bounds = getShapeBounds(doc, shape);
  const anchor = endpoint.anchor ?? "center";

  let rawPoint: { x: number; y: number };
  switch (anchor) {
    case "top":
      rawPoint = { x: bounds.x + bounds.width / 2, y: bounds.y };
      break;
    case "bottom":
      rawPoint = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height };
      break;
    case "left":
      rawPoint = { x: bounds.x, y: bounds.y + bounds.height / 2 };
      break;
    case "right":
      rawPoint = { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 };
      break;
    case "center":
    case "auto":
    default:
      rawPoint = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      break;
  }

  if (shape.rotation && shape.rotation !== 0) {
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const rad = (shape.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = cx + (rawPoint.x - cx) * cos - (rawPoint.y - cy) * sin;
    const ry = cy + (rawPoint.x - cx) * sin + (rawPoint.y - cy) * cos;
    return { x: Math.round(rx), y: Math.round(ry) };
  }

  return rawPoint;
}

export type EdgeAnchor = "top" | "right" | "bottom" | "left";

export function nearestEdgeAnchor(
  bounds: { x: number; y: number; width: number; height: number },
  towardX: number,
  towardY: number
): EdgeAnchor {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const dx = towardX - cx;
  const dy = towardY - cy;
  if (Math.abs(dx) * bounds.height > Math.abs(dy) * bounds.width) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "bottom" : "top";
}

function resolveAutoEndpoint(
  doc: CanvasDocument,
  endpoint: ArrowEndpoint,
  towardPoint: { x: number; y: number }
): { x: number; y: number } {
  if (!isBoundEndpoint(endpoint)) return endpoint;
  const anchor = endpoint.anchor ?? "auto";
  if (anchor !== "auto") return resolveArrowEndpoint(doc, endpoint);

  const shape = doc.shapes.find((s) => s.id === endpoint.shapeId);
  if (!shape) return resolveArrowEndpoint(doc, endpoint);

  const bounds = getShapeBounds(doc, shape);
  const side = nearestEdgeAnchor(bounds, towardPoint.x, towardPoint.y);
  return resolveArrowEndpoint(doc, { shapeId: endpoint.shapeId, anchor: side });
}

export function resolveArrowRenderEndpoints(
  doc: CanvasDocument,
  arrow: ArrowShape
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const startHint = resolveArrowEndpoint(doc, arrow.start);
  const endHint = resolveArrowEndpoint(doc, arrow.end);
  return {
    start: resolveAutoEndpoint(doc, arrow.start, endHint),
    end: resolveAutoEndpoint(doc, arrow.end, startHint),
  };
}

export function generateShapeId(prefix = "s"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function validateFreeformRefs(doc: CanvasDocument): string[] {
  const errors: string[] = [];
  const idSet = new Set<string>();
  const nameSet = new Set<string>();

  // Check for duplicate IDs
  for (const shape of doc.shapes) {
    if (idSet.has(shape.id)) {
      errors.push(`Duplicate shape id: ${shape.id}`);
    }
    idSet.add(shape.id);

    if (shape.name) {
      if (nameSet.has(shape.name)) {
        errors.push(`Duplicate shape name: ${shape.name}`);
      }
      nameSet.add(shape.name);
    }
  }

  // Check frameId references and arrow shape references
  for (const shape of doc.shapes) {
    if (shape.frameId && shape.frameId !== null) {
      const frameExists = doc.shapes.some((s) => s.id === shape.frameId && s.type === "frame");
      if (!frameExists) {
        errors.push(`Shape ${shape.id} has frameId "${shape.frameId}" which is not a frame`);
      }
    }

    if (shape.type === "arrow" || shape.type === "line") {
      const arrowShape = shape as ArrowShape;
      if (isBoundEndpoint(arrowShape.start)) {
        const startRef = arrowShape.start as { shapeId: string };
        const startTarget = doc.shapes.find((s) => s.id === startRef.shapeId);
        if (!startTarget) {
          errors.push(`Arrow ${shape.id} start references missing shape "${startRef.shapeId}"`);
        } else if (startTarget.type === "arrow" || startTarget.type === "line") {
          errors.push(`Arrow ${shape.id} endpoint may not bind to arrow/line "${startRef.shapeId}"`);
        }
      }
      if (isBoundEndpoint(arrowShape.end)) {
        const endRef = arrowShape.end as { shapeId: string };
        const endTarget = doc.shapes.find((s) => s.id === endRef.shapeId);
        if (!endTarget) {
          errors.push(`Arrow ${shape.id} end references missing shape "${endRef.shapeId}"`);
        } else if (endTarget.type === "arrow" || endTarget.type === "line") {
          errors.push(`Arrow ${shape.id} endpoint may not bind to arrow/line "${endRef.shapeId}"`);
        }
      }
    }

    if (shape.onClickNavigateToFrameId) {
      const frameExists = doc.shapes.some((s) => s.id === shape.onClickNavigateToFrameId && s.type === "frame");
      if (!frameExists) {
        errors.push(`Shape ${shape.id} has onClickNavigateToFrameId "${shape.onClickNavigateToFrameId}" which is not a frame`);
      }
    }
  }

  return errors;
}

export const CANVAS_PALETTE: Record<string, { light: string; dark: string }> = {
  "1": { light: "#e03131", dark: "#ff8787" },
  "2": { light: "#e8590c", dark: "#ffa94d" },
  "3": { light: "#f08c00", dark: "#ffd43b" },
  "4": { light: "#2f9e44", dark: "#69db7c" },
  "5": { light: "#1971c2", dark: "#4dabf7" },
  "6": { light: "#9c36b5", dark: "#da77f2" },
};

export function resolveColor(value: string | undefined, theme: "light" | "dark" = "light"): string | undefined {
  if (value === undefined) return undefined;
  const paletteEntry = CANVAS_PALETTE[value];
  return paletteEntry ? paletteEntry[theme] : value;
}
