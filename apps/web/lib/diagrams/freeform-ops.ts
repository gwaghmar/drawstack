import {
  type CanvasDocument,
  type CanvasShape,
  type ArrowShape,
  type ArrowEndpoint,
  generateShapeId,
  getShapeBounds,
  resolveArrowEndpoint,
  validateFreeformRefs,
} from "./freeform-canvas.ts";

export type CanvasOp =
  | { op: "add"; shape: Partial<CanvasShape> & { type: CanvasShape["type"] } }
  | { op: "update"; target: string; set: Record<string, unknown> }
  | { op: "delete"; target: string }
  | {
      op: "connect";
      from: string;
      to: string;
      label?: string;
      id?: string;
      name?: string;
      kind?: "arrow" | "line";
      routing?: "straight" | "curved" | "orthogonal";
      arrowStart?: boolean;
      arrowEnd?: boolean;
    }
  | {
      op: "place";
      target: string;
      below?: string;
      above?: string;
      rightOf?: string;
      leftOf?: string;
      inside?: string;
      gap?: number;
      align?: "start" | "center" | "end";
    }
  | { op: "layout"; targets: string[]; arrange: "row" | "column" | "grid"; gap?: number; origin?: { x: number; y: number } }
  | { op: "reorder"; target: string; to: "front" | "back" | "forward" | "backward" };

export type ApplyResult = {
  doc: CanvasDocument;
  applied: number;
  errors: { index: number; op: string; message: string }[];
};

const DEFAULT_SIZE: Record<string, { width: number; height: number }> = {
  rectangle: { width: 160, height: 80 },
  ellipse: { width: 160, height: 80 },
  diamond: { width: 160, height: 80 },
  triangle: { width: 160, height: 100 },
  cylinder: { width: 160, height: 100 },
  cloud: { width: 180, height: 100 },
  hexagon: { width: 160, height: 100 },
  star: { width: 120, height: 120 },
  sticky: { width: 180, height: 180 },
  text: { width: 120, height: 30 },
  frame: { width: 400, height: 300 },
  card: { width: 220, height: 120 },
  table: { width: 240, height: 160 },
  image: { width: 200, height: 150 },
  metric: { width: 220, height: 110 },
  dashboard: { width: 1280, height: 800 },
  chart: { width: 360, height: 220 },
  feed_table: { width: 380, height: 280 },
  mindmap: { width: 500, height: 800 },
  scurve_timeline: { width: 680, height: 850 },
  isometric_block: { width: 680, height: 600 },
  mockup: { width: 640, height: 420 },
};

class OpError extends Error {}

function resolveTarget(doc: CanvasDocument, target: string): CanvasShape {
  const byId = doc.shapes.find((s) => s.id === target);
  if (byId) return byId;

  const byName = doc.shapes.filter((s) => s.name === target);
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) {
    throw new OpError(`Ambiguous target "${target}": matches ${byName.map((s) => s.id).join(", ")}`);
  }

  throw new OpError(`Target "${target}" not found`);
}

function round(n: number): number {
  return Math.round(n);
}

function estimateTextWidth(content: string, fontSize: number): number {
  return content.length * fontSize * 0.6 * 1.15;
}

function applyAdd(doc: CanvasDocument, partial: Partial<CanvasShape> & { type: CanvasShape["type"] }): CanvasShape {
  const type = partial.type;
  const defaults = DEFAULT_SIZE[type] ?? { width: 160, height: 80 };

  let id = partial.id ?? generateShapeId();
  if (doc.shapes.some((s) => s.id === id)) {
    id = generateShapeId();
  }

  if (partial.name) {
    const nameCollision = doc.shapes.some((s) => s.name === partial.name);
    if (nameCollision) {
      throw new OpError(`Shape name "${partial.name}" already exists`);
    }
  }

  const x = partial.x ?? 0;
  const y = partial.y ?? 0;

  const shape: Record<string, unknown> = {
    ...partial,
    id,
    x: round(x),
    y: round(y),
  };

  if (type === "arrow" || type === "line") {
    if (!("start" in partial) || !("end" in partial)) {
      throw new OpError(`add ${type} requires "start" and "end" endpoints`);
    }
  }

  if (type !== "arrow" && type !== "line") {
    const explicitWidth = (partial as { width?: number }).width;
    const explicitHeight = (partial as { height?: number }).height;
    let width = explicitWidth ?? defaults.width;
    let height = explicitHeight ?? defaults.height;

    const text = (partial as { text?: { content: string; fontSize?: number } }).text;
    if (text?.content) {
      const fontSize = text.fontSize ?? 16;
      if (explicitWidth === undefined) {
        const estimated = estimateTextWidth(text.content, fontSize);
        width = Math.max(defaults.width, round(estimated));
      }
      if (type === "text" && explicitHeight === undefined) {
        height = round(fontSize * 1.5);
      }
    }

    shape.width = round(width);
    shape.height = round(height);
  }

  return shape as CanvasShape;
}

function setDottedPath(shape: CanvasShape, key: string, value: unknown): CanvasShape {
  if (key.startsWith("text.")) {
    const field = key.slice("text.".length);
    const existingText = (shape as { text?: Record<string, unknown> }).text ?? { content: "" };
    return {
      ...shape,
      text: { ...existingText, [field]: value },
    } as CanvasShape;
  }
  const roundable = new Set(["x", "y", "width", "height"]);
  const finalValue = roundable.has(key) && typeof value === "number" ? round(value) : value;
  return { ...shape, [key]: finalValue } as CanvasShape;
}

function applyUpdate(shape: CanvasShape, set: Record<string, unknown>): CanvasShape {
  let next = shape;
  for (const [key, value] of Object.entries(set)) {
    next = setDottedPath(next, key, value);
  }
  return next;
}

function applyDelete(doc: CanvasDocument, target: CanvasShape): CanvasShape[] {
  const frozenArrows = doc.shapes.map((s) => {
    if (s.type !== "arrow" && s.type !== "line") return s;
    const arrow = s as ArrowShape;
    let start: ArrowEndpoint = arrow.start;
    let end: ArrowEndpoint = arrow.end;
    if ("shapeId" in arrow.start && arrow.start.shapeId === target.id) {
      const resolved = resolveArrowEndpoint(doc, arrow.start);
      start = { x: resolved.x, y: resolved.y };
    }
    if ("shapeId" in arrow.end && arrow.end.shapeId === target.id) {
      const resolved = resolveArrowEndpoint(doc, arrow.end);
      end = { x: resolved.x, y: resolved.y };
    }
    if (start === arrow.start && end === arrow.end) return s;
    return { ...arrow, start, end };
  });

  return frozenArrows
    .filter((s) => s.id !== target.id)
    .map((s) => (s.frameId === target.id ? { ...s, frameId: null } : s));
}

function applyConnect(
  doc: CanvasDocument,
  from: CanvasShape,
  to: CanvasShape,
  op: {
    label?: string;
    id?: string;
    name?: string;
    kind?: "arrow" | "line";
    routing?: "straight" | "curved" | "orthogonal";
    arrowStart?: boolean;
    arrowEnd?: boolean;
  }
): CanvasShape {
  if (from.type === "arrow" || from.type === "line") throw new OpError(`connect "from" cannot be an arrow/line: ${from.id}`);
  if (to.type === "arrow" || to.type === "line") throw new OpError(`connect "to" cannot be an arrow/line: ${to.id}`);

  let id = op.id ?? generateShapeId();
  if (doc.shapes.some((s) => s.id === id)) id = generateShapeId();

  const arrow: ArrowShape = {
    id,
    type: op.kind ?? "arrow",
    x: 0,
    y: 0,
    start: { shapeId: from.id, anchor: "auto" },
    end: { shapeId: to.id, anchor: "auto" },
    ...(op.label ? { label: op.label } : {}),
    ...(op.name ? { name: op.name } : {}),
    ...(op.routing ? { routing: op.routing } : {}),
    ...(op.arrowStart !== undefined ? { arrowStart: op.arrowStart } : {}),
    ...(op.arrowEnd !== undefined ? { arrowEnd: op.arrowEnd } : {}),
  };
  return arrow;
}

function applyPlace(
  doc: CanvasDocument,
  target: CanvasShape,
  op: {
    below?: string;
    above?: string;
    rightOf?: string;
    leftOf?: string;
    inside?: string;
    gap?: number;
    align?: "start" | "center" | "end";
  }
): CanvasShape {
  const refKeys = (["below", "above", "rightOf", "leftOf", "inside"] as const).filter((k) => op[k] !== undefined);
  if (refKeys.length !== 1) {
    throw new OpError(`place requires exactly one of below/above/rightOf/leftOf/inside`);
  }
  const gap = op.gap ?? 60;
  const align = op.align ?? "center";
  const key = refKeys[0];

  if (key === "inside") {
    const frame = resolveTarget(doc, op.inside as string);
    if (frame.type !== "frame") {
      throw new OpError(`place "inside" target "${op.inside}" is not a frame`);
    }
    const targetBounds = getShapeBounds(doc, target);
    const isUnplaced = target.x === 0 && target.y === 0;
    if (isUnplaced) {
      return { ...target, frameId: frame.id, x: round(frame.x + 24), y: round(frame.y + 24) };
    }
    return { ...target, frameId: frame.id };
  }

  const ref = resolveTarget(doc, op[key] as string);
  const refBounds = getShapeBounds(doc, ref);
  const targetBounds = getShapeBounds(doc, target);

  let x = target.x;
  let y = target.y;

  if (key === "below" || key === "above") {
    y = key === "below" ? refBounds.y + refBounds.height + gap : refBounds.y - gap - targetBounds.height;
    if (align === "start") x = refBounds.x;
    else if (align === "end") x = refBounds.x + refBounds.width - targetBounds.width;
    else x = refBounds.x + refBounds.width / 2 - targetBounds.width / 2;
  } else {
    x = key === "rightOf" ? refBounds.x + refBounds.width + gap : refBounds.x - gap - targetBounds.width;
    if (align === "start") y = refBounds.y;
    else if (align === "end") y = refBounds.y + refBounds.height - targetBounds.height;
    else y = refBounds.y + refBounds.height / 2 - targetBounds.height / 2;
  }

  return { ...target, x: round(x), y: round(y) };
}

function applyLayout(
  doc: CanvasDocument,
  targets: CanvasShape[],
  arrange: "row" | "column" | "grid",
  gap: number,
  origin: { x: number; y: number } | undefined,
  errors: string[]
): CanvasShape[] {
  const laid: CanvasShape[] = [];
  const valid: CanvasShape[] = [];
  for (const t of targets) {
    if (t.type === "arrow" || t.type === "line") {
      errors.push(`layout target "${t.id}" is an arrow/line and cannot be laid out`);
      continue;
    }
    valid.push(t);
  }

  if (valid.length === 0) return laid;

  const start = origin ?? (() => {
    const boundsList = valid.map((s) => getShapeBounds(doc, s));
    const minX = Math.min(...boundsList.map((b) => b.x));
    const minY = Math.min(...boundsList.map((b) => b.y));
    return { x: minX, y: minY };
  })();

  const cols = arrange === "grid" ? Math.ceil(Math.sqrt(valid.length)) : arrange === "row" ? valid.length : 1;

  let cursorX = start.x;
  let cursorY = start.y;
  let rowMaxHeight = 0;
  let colMaxWidth = 0;

  if (arrange === "row") {
    for (const t of valid) {
      const bounds = getShapeBounds(doc, t);
      laid.push({ ...t, x: round(cursorX), y: round(start.y) });
      cursorX += bounds.width + gap;
    }
    return laid;
  }

  if (arrange === "column") {
    for (const t of valid) {
      const bounds = getShapeBounds(doc, t);
      laid.push({ ...t, x: round(start.x), y: round(cursorY) });
      cursorY += bounds.height + gap;
    }
    return laid;
  }

  // grid
  let colIndex = 0;
  let rowY = start.y;
  let i = 0;
  while (i < valid.length) {
    const rowShapes = valid.slice(i, i + cols);
    const heights = rowShapes.map((s) => getShapeBounds(doc, s).height);
    const thisRowMaxHeight = Math.max(...heights);
    let colX = start.x;
    for (const t of rowShapes) {
      const bounds = getShapeBounds(doc, t);
      laid.push({ ...t, x: round(colX), y: round(rowY) });
      colX += bounds.width + gap;
    }
    rowY += thisRowMaxHeight + gap;
    i += cols;
  }

  return laid;
}

function applyReorder(shapes: CanvasShape[], target: CanvasShape, to: "front" | "back" | "forward" | "backward"): CanvasShape[] {
  const index = shapes.findIndex((s) => s.id === target.id);
  const without = shapes.filter((s) => s.id !== target.id);

  switch (to) {
    case "front":
      return [...without, target];
    case "back":
      return [target, ...without];
    case "forward": {
      const newIndex = Math.min(index + 1, shapes.length - 1);
      const arr = without.slice();
      arr.splice(newIndex, 0, target);
      return arr;
    }
    case "backward": {
      const newIndex = Math.max(index - 1, 0);
      const arr = without.slice();
      arr.splice(newIndex, 0, target);
      return arr;
    }
  }
}

export function applyCanvasOps(doc: CanvasDocument, ops: CanvasOp[]): ApplyResult {
  let shapes = doc.shapes;
  let applied = 0;
  const errors: { index: number; op: string; message: string }[] = [];

  const currentDoc = (): CanvasDocument => ({ version: doc.version, shapes });

  ops.forEach((op, index) => {
    try {
      switch (op.op) {
        case "add": {
          const shape = applyAdd(currentDoc(), op.shape);
          shapes = [...shapes, shape];
          applied++;
          break;
        }
        case "update": {
          const target = resolveTarget(currentDoc(), op.target);
          const updated = applyUpdate(target, op.set);
          shapes = shapes.map((s) => (s.id === target.id ? updated : s));
          applied++;
          break;
        }
        case "delete": {
          const target = resolveTarget(currentDoc(), op.target);
          shapes = applyDelete(currentDoc(), target);
          applied++;
          break;
        }
        case "connect": {
          const from = resolveTarget(currentDoc(), op.from);
          const to = resolveTarget(currentDoc(), op.to);
          const arrow = applyConnect(currentDoc(), from, to, op);
          shapes = [...shapes, arrow];
          applied++;
          break;
        }
        case "place": {
          const target = resolveTarget(currentDoc(), op.target);
          const placed = applyPlace(currentDoc(), target, op);
          shapes = shapes.map((s) => (s.id === target.id ? placed : s));
          applied++;
          break;
        }
        case "layout": {
          const targets = op.targets.map((t) => resolveTarget(currentDoc(), t));
          const localErrors: string[] = [];
          const laid = applyLayout(currentDoc(), targets, op.arrange, op.gap ?? 40, op.origin, localErrors);
          if (localErrors.length > 0) {
            for (const message of localErrors) {
              errors.push({ index, op: op.op, message });
            }
          }
          const laidById = new Map(laid.map((s) => [s.id, s]));
          shapes = shapes.map((s) => laidById.get(s.id) ?? s);
          if (laid.length > 0) applied++;
          break;
        }
        case "reorder": {
          const target = resolveTarget(currentDoc(), op.target);
          shapes = applyReorder(shapes, target, op.to);
          applied++;
          break;
        }
      }
    } catch (e) {
      errors.push({ index, op: op.op, message: e instanceof OpError || e instanceof Error ? e.message : String(e) });
    }
  });

  const finalDoc: CanvasDocument = { version: doc.version, shapes };
  const preExistingErrors = new Set(validateFreeformRefs(doc));
  const postErrors = validateFreeformRefs(finalDoc);
  for (const message of postErrors) {
    if (!preExistingErrors.has(message)) {
      errors.push({ index: -1, op: "post-validate", message });
    }
  }

  return { doc: finalDoc, applied, errors };
}
