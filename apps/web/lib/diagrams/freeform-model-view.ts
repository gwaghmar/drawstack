import {
  type CanvasDocument,
  type CanvasShape,
  type ArrowShape,
  type ArrowEndpoint,
  isBoundEndpoint,
  getShapeBounds,
} from "./freeform-canvas.ts";

function round(n: number): number {
  return Math.round(n);
}

function serializeEndpoint(endpoint: ArrowEndpoint): Record<string, unknown> {
  if (isBoundEndpoint(endpoint)) {
    const out: Record<string, unknown> = { shapeId: endpoint.shapeId };
    if (endpoint.anchor !== undefined && endpoint.anchor !== "auto") out.anchor = endpoint.anchor;
    return out;
  }
  return { x: round(endpoint.x), y: round(endpoint.y) };
}

function serializeText(text: NonNullable<CanvasShape["text"]>): Record<string, unknown> {
  const out: Record<string, unknown> = { content: text.content };
  if (text.fontSize !== undefined) out.fontSize = round(text.fontSize);
  if (text.fontFamily !== undefined) out.fontFamily = text.fontFamily;
  if (text.align !== undefined) out.align = text.align;
  if (text.color !== undefined) out.color = text.color;
  if (text.bold !== undefined) out.bold = text.bold;
  return out;
}

function serializeShapeLine(shape: CanvasShape): string {
  const out: Record<string, unknown> = {};

  out.id = shape.id;
  if (shape.name !== undefined) out.name = shape.name;
  if (shape.role !== undefined) out.role = shape.role;
  out.type = shape.type;

  const isArrow = shape.type === "arrow" || shape.type === "line";
  if (!isArrow) {
    out.x = round(shape.x);
    out.y = round(shape.y);
    const sized = shape as Exclude<CanvasShape, ArrowShape>;
    out.width = round(sized.width);
    out.height = round(sized.height);
  }

  if (shape.rotation !== undefined && shape.rotation !== 0) out.rotation = round(shape.rotation);
  if (shape.fill !== undefined) out.fill = shape.fill;
  if (shape.stroke !== undefined) out.stroke = shape.stroke;
  if (shape.strokeWidth !== undefined) out.strokeWidth = round(shape.strokeWidth);
  if (shape.opacity !== undefined && shape.opacity !== 1) out.opacity = shape.opacity;

  if (shape.type === "rectangle" && shape.cornerRadius !== undefined) {
    out.cornerRadius = round(shape.cornerRadius);
  }

  if (shape.frameId !== undefined && shape.frameId !== null) out.frameId = shape.frameId;
  if (shape.locked !== undefined) out.locked = shape.locked;
  if (shape.text !== undefined) out.text = serializeText(shape.text);

  if (isArrow) {
    const arrow = shape as ArrowShape;
    if (arrow.label !== undefined) out.label = arrow.label;
    out.start = serializeEndpoint(arrow.start);
    out.end = serializeEndpoint(arrow.end);
  }

  return JSON.stringify(out);
}

export function serializeForModel(doc: CanvasDocument): string {
  const header = `canvas v1 | ${doc.shapes.length} shapes | coordinates: canvas-absolute px, y grows downward`;
  const lines = doc.shapes.map(serializeShapeLine);
  return [header, ...lines].join("\n");
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function describeCanvas(doc: CanvasDocument): string {
  if (doc.shapes.length === 0) return "Empty canvas.";

  const countByType = new Map<string, number>();
  for (const shape of doc.shapes) {
    countByType.set(shape.type, (countByType.get(shape.type) ?? 0) + 1);
  }
  const countSummary = Array.from(countByType.entries())
    .map(([type, count]) => `${count} ${type}${count === 1 ? "" : "s"}`)
    .join(", ");

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const shape of doc.shapes) {
    const bounds = getShapeBounds(doc, shape);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }
  const bboxSummary = `bounding box (${round(minX)}, ${round(minY)}) to (${round(maxX)}, ${round(maxY)})`;

  const named = doc.shapes.filter((s) => s.name !== undefined);
  const notable: string[] = named.slice(0, 10).map((s) => `${s.name} (${s.type})`);

  if (notable.length < 10) {
    const withText = doc.shapes.filter((s) => s.name === undefined && s.text?.content);
    for (const shape of withText) {
      if (notable.length >= 10) break;
      notable.push(`"${truncate(shape.text!.content, 30)}" (${shape.type})`);
    }
  }

  const notableSummary = notable.length > 0 ? ` Notable shapes: ${notable.join(", ")}.` : "";

  return `Canvas contains ${countSummary}, spanning a ${bboxSummary}.${notableSummary}`;
}

export const MODEL_VIEW_GUIDE = `Canvas model view format:
- Header line: "canvas v1 | N shapes | coordinates: canvas-absolute px, y grows downward"
- One shape per line after the header, each a minified JSON object independently parseable.
- Fixed key order per line: id, name, role, type, x, y, width, height, rotation, fill,
  stroke, strokeWidth, opacity, cornerRadius, frameId, locked, text, label, start, end.
  Keys are omitted when absent, rotation:0, opacity:1, or frameId:null.
- All coordinates and sizes are canvas-absolute integers (not viewport-relative).
- Line order = z-order (later lines render on top).
- Colors may be a palette key "1"-"6" (1 red, 2 orange, 3 yellow, 4 green, 5 blue,
  6 purple, light-theme meanings) or a literal hex string — left unresolved here.
- Arrow/line shapes omit "x"/"y" — their position is derived from their "start"/"end"
  endpoints, not a standalone coordinate.
- Arrow "start"/"end" are either {"shapeId","anchor"} bound endpoints (anchor omitted
  when "auto") or free {"x","y"} points.
- To edit the canvas, do not rewrite this text — express changes as ops
  (add/update/delete/connect/place/layout/reorder); the ops schema lives separately.`;
