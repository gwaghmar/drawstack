export type CanvasComment = {
  id: string;
  x: number;
  y: number;
  text: string;
  author?: string;
  authorColor?: string;
  createdAt: number;
  resolved?: boolean;
};

export type CanvasDocument = {
  version: 1;
  renderMode?: "clean" | "sketchy";
  presentationMode?: boolean;
  shapes: CanvasShape[];
  /** Pinned canvas annotations — never rendered in SVG/PNG/PDF export, never authored by AI generation. */
  comments?: CanvasComment[];
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
  /** false = flat, no drop shadow in SVG export (Konva has never drawn one) */
  shadow?: boolean;
  text?: {
    content: string;
    fontSize?: number;
    fontFamily?: string;
    align?: "left" | "center" | "right";
    color?: string;
    bold?: boolean;
    /** false = never soft-wrap (ASCII art, terminal layouts); explicit \n only */
    wrap?: boolean;
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
  chartType: "area" | "bar" | "grouped_bar" | "donut" | "horizontal_bar" | "progress_gauge" | "line" | "treemap";
  data?: { label: string; value: number; color?: string; isEstimate?: boolean }[];
  groupedData?: { category: string; series: { name: string; value: number; color?: string; formatted?: string; isEstimate?: boolean }[] }[];
  donutData?: { label: string; value: string; percent: number; color: string }[];
  centerLabel?: { primary: string; secondary?: string };
  progressSegments?: { label: string; value: string; percent: number; color: string }[];
  callouts?: { category: string; text: string; color?: string }[];
  treemapData?: { label: string; value: number; sublabel?: string; color?: string; group?: string }[];
  treemapLegend?: { label: string; color: string }[];
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

export type StepTimelineShape = BaseShape & {
  type: "step_timeline";
  width: number;
  height: number;
  title?: string;
  accentColor?: string;
  background?: string;
  steps: { label?: string; title: string; description?: string }[];
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

export type DotMatrixShape = BaseShape & {
  type: "dot_matrix";
  width: number;
  height: number;
  /** One string per row; each char is a density 0-9 (or " .:-=+*#%@" ramp). Dot size scales with density. */
  rows: string[];
  dotColor?: string;
  /** Color for zero-density cells; omit for none */
  offColor?: string;
  background?: string;
  glyph?: "circle" | "square" | "diamond";
};

export type PathShape = BaseShape & {
  type: "path";
  points: [number, number][];
};

export type MeshConnectorShape = BaseShape & {
  type: "mesh_connector";
  width: number;
  height: number;
  fromCount: number;
  toCount: number;
  /** horizontal (default): left edge -> right edge. vertical: top edge -> bottom edge. */
  orientation?: "horizontal" | "vertical";
  lineColor?: string;
  lineOpacity?: number;
  dotColor?: string;
  dotRadius?: number;
};

export type PictogramShape = BaseShape & {
  type: "pictogram";
  width: number;
  height: number;
  icon: string;
};

export type PictogramRowShape = BaseShape & {
  type: "pictogram_row";
  width: number;
  height: number;
  icon: string;
  count: number;
  filled: number;
  color?: string;
  mutedColor?: string;
};

export type ArrowEndpoint =
  | { x: number; y: number }
  | { shapeId: string; anchor?: "top" | "right" | "bottom" | "left" | "center" | "auto" };

export type ArrowHeadStyle =
  | "arrow"
  | "triangle-open"
  | "diamond"
  | "diamond-open"
  | "crowfoot-one"
  | "crowfoot-many"
  | "crowfoot-zero-one"
  | "crowfoot-one-many"
  | "crowfoot-zero-many"
  | "none";

export type ArrowHeadMark =
  | { kind: "polygon"; points: { x: number; y: number }[]; filled: boolean }
  | { kind: "polyline"; points: { x: number; y: number }[] }
  | { kind: "circle"; cx: number; cy: number; r: number };

export type ArrowShape = BaseShape & {
  type: "arrow" | "line";
  start: ArrowEndpoint;
  end: ArrowEndpoint;
  label?: string;
  /** "plain" drops the pill border/shadow, keeping only a knockout behind the text */
  labelStyle?: "pill" | "plain";
  routing?: "straight" | "curved" | "orthogonal";
  arrowStart?: boolean;
  arrowEnd?: boolean;
  /** UML-style heads; when set they win over the arrowStart/arrowEnd booleans */
  arrowHeadStart?: ArrowHeadStyle;
  arrowHeadEnd?: ArrowHeadStyle;
  /** intermediate points, in order, between resolved start and end */
  waypoints?: { x: number; y: number }[];
  /** draw small hollow circles at start, each waypoint, and end */
  showJunctions?: boolean;
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
  | StepTimelineShape
  | IsometricBlockShape
  | MockupShape
  | VennTimelineShape
  | TechHudPanelShape
  | LayeredProcessMapShape
  | DotMatrixShape
  | PathShape
  | PictogramShape
  | PictogramRowShape
  | MeshConnectorShape
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

  // Card/table/metric/frame/mockup size themselves from content above; every
  // other type has no such logic and, contrary to the AI-output validator's
  // documented assumption, previously just returned whatever width/height it
  // was given -- undefined when the AI omitted them, which is common. That
  // silently broke rendering (NaN/zero-size shapes) instead of falling
  // through to any auto-sizing. This is the actual fallback for those types.
  const s = shape as Exclude<CanvasShape, ArrowShape | PathShape>;
  const fallback = PRIMITIVE_DEFAULT_SIZE[s.type] ?? PRIMITIVE_DEFAULT_SIZE.rectangle;
  return {
    x: s.x,
    y: s.y,
    width: s.width ?? fallback.width,
    height: s.height ?? fallback.height,
  };
}

// Mirrors the click-to-place defaults in freeform-renderer.tsx's defaultSizeFor —
// kept here too since this file is imported by the SVG exporter, which the
// renderer file is not.
export const PRIMITIVE_DEFAULT_SIZE: Record<string, { width: number; height: number }> = {
  rectangle: { width: 160, height: 90 },
  ellipse: { width: 160, height: 90 },
  sticky: { width: 180, height: 180 },
  text: { width: 140, height: 36 },
  frame: { width: 440, height: 320 },
  triangle: { width: 160, height: 120 },
  cylinder: { width: 160, height: 120 },
  cloud: { width: 180, height: 110 },
  hexagon: { width: 160, height: 110 },
  star: { width: 130, height: 130 },
  diamond: { width: 160, height: 100 },
};

export function getShapeBounds(doc: CanvasDocument, shape: CanvasShape): { x: number; y: number; width: number; height: number } {
  if (shape.type === "arrow" || shape.type === "line") {
    const start = resolveArrowEndpoint(doc, shape.start);
    const end = resolveArrowEndpoint(doc, shape.end);
    const pts = [start, end, ...(shape.waypoints ?? [])];
    const minX = Math.min(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxX = Math.max(...pts.map((p) => p.x));
    const maxY = Math.max(...pts.map((p) => p.y));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
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

export function resolveArrowHeadStyle(arrow: ArrowShape, end: "start" | "end"): ArrowHeadStyle {
  const explicit = end === "start" ? arrow.arrowHeadStart : arrow.arrowHeadEnd;
  if (explicit) return explicit;
  if (arrow.type === "line") return "none";
  const on = end === "start" ? arrow.arrowStart === true : arrow.arrowEnd !== false;
  return on ? "arrow" : "none";
}

/** Head marks + the point the line must stop at so it never pokes through an open head. */
export function computeArrowHeadGeometry(
  tip: { x: number; y: number },
  from: { x: number; y: number },
  style: ArrowHeadStyle,
  strokeWidth = 2
): { marks: ArrowHeadMark[]; lineEnd: { x: number; y: number } } | null {
  if (style === "none" || style === "arrow") return null;

  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  const scale = Math.max(1, strokeWidth / 1.5);
  const at = (along: number, across: number) => ({
    x: tip.x - ux * along * scale + nx * across * scale,
    y: tip.y - uy * along * scale + ny * across * scale,
  });

  if (style === "triangle-open" || style === "diamond" || style === "diamond-open") {
    const depth = style === "triangle-open" ? 13 : 18;
    const half = 5.5;
    const points =
      style === "triangle-open"
        ? [tip, at(depth, half), at(depth, -half)]
        : [tip, at(depth / 2, half), at(depth, 0), at(depth / 2, -half)];
    return { marks: [{ kind: "polygon", points, filled: style === "diamond" }], lineEnd: at(depth, 0) };
  }

  // Crow's foot (ERD cardinality). The foot opens onto the entity edge; bars and
  // the optionality ring sit further back along the line.
  const FOOT = 14;
  const half = 7;
  const marks: ArrowHeadMark[] = [];
  const hasFoot = style === "crowfoot-many" || style === "crowfoot-one-many" || style === "crowfoot-zero-many";
  const hasRing = style === "crowfoot-zero-one" || style === "crowfoot-zero-many";

  if (hasFoot) {
    marks.push({ kind: "polyline", points: [at(0, half), at(FOOT, 0), at(0, -half)] });
    marks.push({ kind: "polyline", points: [at(FOOT, 0), at(0, 0)] });
  }

  const barAt = style === "crowfoot-one-many" ? FOOT + 6 : hasFoot ? FOOT + 6 : 9;
  if (style !== "crowfoot-zero-many" && style !== "crowfoot-many") {
    marks.push({ kind: "polyline", points: [at(barAt, half), at(barAt, -half)] });
  }

  const ringCenter = hasFoot ? FOOT + 5 : 15;
  if (hasRing) {
    const c = at(ringCenter, 0);
    marks.push({ kind: "circle", cx: c.x, cy: c.y, r: 5 * scale });
  }

  const lineEnd = hasRing
    ? at(ringCenter + 5, 0)
    : hasFoot
      ? at(style === "crowfoot-one-many" ? barAt : FOOT, 0)
      : at(barAt, 0);

  return { marks, lineEnd };
}

export function wrapTextLines(content: string, maxChars: number): string[] {
  return content.split("\n").flatMap((raw) => {
    if (raw.length <= maxChars) return [raw];
    const out: string[] = [];
    let cur = "";
    for (const word of raw.split(" ")) {
      const candidate = cur ? `${cur} ${word}` : word;
      if (candidate.length > maxChars && cur) {
        out.push(cur);
        cur = word;
      } else {
        cur = candidate;
      }
    }
    if (cur) out.push(cur);
    return out;
  });
}

const TEXT_LINE_HEIGHT = 1.35;

/** Shrinks (never grows) the font so wrapped copy stays inside the shape instead of spilling past it. */
export function fitTextFontSize(opts: {
  content: string;
  width: number;
  height: number;
  fontSize: number;
  bold?: boolean;
  wrap?: boolean;
}): number {
  if (opts.wrap === false) return opts.fontSize;
  const availW = Math.max(24, opts.width - 24);
  const availH = Math.max(12, opts.height - 4);
  const floor = Math.max(8, opts.fontSize * 0.6);

  for (let size = opts.fontSize; size >= floor; size -= 0.5) {
    const maxChars = Math.max(4, Math.floor(availW / (size * (opts.bold ? 0.58 : 0.55))));
    const lines = wrapTextLines(opts.content, maxChars).length;
    // Leading only sits between lines; a single line needs glyph height, not a full line box.
    if ((lines - 1) * size * TEXT_LINE_HEIGHT + size * 1.15 <= availH) return size;
  }
  return floor;
}
