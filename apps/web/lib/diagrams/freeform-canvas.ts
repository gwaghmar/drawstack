export type CanvasDocument = { version: 1; shapes: CanvasShape[] };

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
  opacity?: number;
  frameId?: string | null;
  locked?: boolean;
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
export type StickyShape = BaseShape & { type: "sticky"; width: number; height: number };
export type TextShape = BaseShape & { type: "text"; width: number; height: number };
export type FrameShape = BaseShape & { type: "frame"; width: number; height: number; name?: string };

export type ArrowEndpoint =
  | { x: number; y: number }
  | { shapeId: string; anchor?: "top" | "right" | "bottom" | "left" | "center" | "auto" };

export type ArrowShape = BaseShape & {
  type: "arrow" | "line";
  start: ArrowEndpoint;
  end: ArrowEndpoint;
  label?: string;
};

export type CanvasShape = RectShape | EllipseShape | DiamondShape | StickyShape | TextShape | FrameShape | ArrowShape;

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

export function getShapeBounds(doc: CanvasDocument, shape: CanvasShape): { x: number; y: number; width: number; height: number } {
  if (shape.type === "arrow" || shape.type === "line") {
    const start = resolveArrowEndpoint(doc, shape.start);
    const end = resolveArrowEndpoint(doc, shape.end);
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    return { x: minX, y: minY, width: Math.max(start.x, end.x) - minX, height: Math.max(start.y, end.y) - minY };
  }
  const s = shape as Exclude<CanvasShape, ArrowShape>;
  return { x: s.x, y: s.y, width: s.width, height: s.height };
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

  switch (anchor) {
    case "top":
      return { x: bounds.x + bounds.width / 2, y: bounds.y };
    case "bottom":
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height };
    case "left":
      return { x: bounds.x, y: bounds.y + bounds.height / 2 };
    case "right":
      return { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 };
    case "center":
    case "auto":
    default:
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  }
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
