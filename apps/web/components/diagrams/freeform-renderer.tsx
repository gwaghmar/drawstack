"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Ellipse, Line, Arrow, Text, Transformer } from "react-konva";
import Konva from "konva";
import {
  parseFreeformSource,
  serializeFreeformDocument,
  resolveArrowRenderEndpoints,
  getShapeBounds,
  generateShapeId,
  type CanvasDocument,
  type CanvasShape,
  type ArrowShape,
} from "@/lib/diagrams/freeform-canvas";

type Props = {
  source: string;
  onChange?: (source: string) => void;
  readOnly?: boolean;
};

type MarqueeState = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type ToolMode = "select" | "arrow" | "place";

type ShapeKind = "rectangle" | "ellipse" | "diamond" | "sticky" | "text" | "frame";

type ArrowDraft = {
  startPoint: { x: number; y: number };
  startBinding: string | null;
  currentPoint: { x: number; y: number };
  hoverShapeId: string | null;
};

type SnapCandidates = { verticals: number[]; horizontals: number[] };

type Viewport = { scale: number; x: number; y: number };

const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 500;
const SNAP_THRESHOLD = 6;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const ZOOM_FACTOR = 1.05;

function stagePointFromEvent(stage: Konva.Stage | null): { x: number; y: number } | null {
  if (!stage) return null;
  return stage.getRelativePointerPosition();
}

function getShapeIdAtPointer(doc: CanvasDocument, stage: Konva.Stage | null): string | null {
  if (!stage) return null;
  const pos = stage.getPointerPosition();
  if (!pos) return null;
  const node = stage.getIntersection(pos);
  const id = node?.id();
  if (!id) return null;
  const shape = doc.shapes.find((s) => s.id === id);
  if (!shape || shape.type === "arrow" || shape.type === "line") return null;
  return shape.id;
}

function defaultFill(shape: CanvasShape): string {
  if (shape.fill) return shape.fill;
  if (shape.type === "sticky") return "#fef08a";
  if (shape.type === "frame") return "transparent";
  return "#ffffff";
}

function defaultStroke(shape: CanvasShape): string {
  if (shape.stroke) return shape.stroke;
  if (shape.type === "frame") return "#94a3b8";
  return "#000000";
}

function defaultSizeFor(kind: ShapeKind): { width: number; height: number } {
  switch (kind) {
    case "sticky":
      return { width: 180, height: 180 };
    case "text":
      return { width: 120, height: 30 };
    case "frame":
      return { width: 400, height: 300 };
    default:
      return { width: 160, height: 80 };
  }
}

function nextFrameName(doc: CanvasDocument): string {
  let max = 0;
  for (const s of doc.shapes) {
    if (s.type !== "frame") continue;
    const m = /^Frame (\d+)$/.exec(s.name ?? "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `Frame ${max + 1}`;
}

function frameContaining(doc: CanvasDocument, x: number, y: number): string | null {
  for (let i = doc.shapes.length - 1; i >= 0; i--) {
    const s = doc.shapes[i];
    if (s.type !== "frame") continue;
    if (x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height) return s.id;
  }
  return null;
}

const FIXTURE_DOCUMENT: CanvasDocument = {
  version: 1,
  shapes: [
    {
      id: "s1",
      type: "rectangle",
      x: 50,
      y: 50,
      width: 160,
      height: 90,
      fill: "#e0e7ff",
      stroke: "#4f46e5",
      strokeWidth: 2,
    },
    {
      id: "s2",
      type: "ellipse",
      x: 280,
      y: 60,
      width: 120,
      height: 120,
      fill: "#fef3c7",
      stroke: "#d97706",
      strokeWidth: 2,
    },
    {
      id: "s3",
      type: "text",
      x: 60,
      y: 70,
      width: 140,
      height: 50,
      text: {
        content: "Freeform canvas — Milestone 1",
        fontSize: 14,
        color: "#000000",
        bold: true,
        align: "center",
      },
    },
    {
      id: "arrow1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "s1", anchor: "right" },
      end: { shapeId: "s2", anchor: "left" },
      stroke: "#6b7280",
      strokeWidth: 2,
    },
  ],
};

function aabbOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function renderShape(
  shape: CanvasShape,
  doc: CanvasDocument,
  isSelected: boolean,
  onShapeClick?: (e: Konva.KonvaEventObject<MouseEvent>, shapeId: string) => void,
  onShapeDragStart?: (shapeId: string, x: number, y: number) => void,
  onShapeDragMove?: (e: Konva.KonvaEventObject<DragEvent>, shapeId: string, x: number, y: number) => void,
  onShapeDragEnd?: (shapeId: string) => void,
  readOnly?: boolean,
  onShapeDblClick?: (shapeId: string) => void,
  editingShapeId?: string | null,
  mode: ToolMode = "select"
): React.ReactNode {
  const isEditingThis = editingShapeId === shape.id;
  const draggable = !readOnly && mode !== "arrow" && mode !== "place";
  const commonProps = {
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation ?? 0,
    fill: defaultFill(shape),
    stroke: defaultStroke(shape),
    strokeWidth: shape.strokeWidth ?? 1,
    opacity: shape.opacity ?? 1,
  };

  if (shape.type === "arrow" || shape.type === "line") {
    const arrowShape = shape as ArrowShape;
    const { start: startPoint, end: endPoint } = resolveArrowRenderEndpoints(doc, arrowShape);
    const stroke = isSelected ? "#4f46e5" : commonProps.stroke;
    const points = [startPoint.x, startPoint.y, endPoint.x, endPoint.y];

    if (shape.type === "arrow") {
      return (
        <Arrow
          key={shape.id}
          id={shape.id}
          points={points}
          stroke={stroke}
          fill={stroke}
          strokeWidth={commonProps.strokeWidth}
          opacity={commonProps.opacity}
          pointerLength={10}
          pointerWidth={10}
          listening={!readOnly}
          onClick={(e) => onShapeClick?.(e, shape.id)}
        />
      );
    }

    return (
      <Line
        key={shape.id}
        id={shape.id}
        points={points}
        stroke={stroke}
        strokeWidth={commonProps.strokeWidth}
        opacity={commonProps.opacity}
        listening={!readOnly}
        onClick={(e) => onShapeClick?.(e, shape.id)}
      />
    );
  }

  const shapeNode = (() => {
    switch (shape.type) {
      case "rectangle":
      case "sticky":
        return (
          <Rect
            key={shape.id}
            id={shape.id}
            {...commonProps}
            width={shape.width}
            height={shape.height}
            cornerRadius={shape.type === "sticky" ? 4 : "cornerRadius" in shape ? shape.cornerRadius : undefined}
            draggable={draggable}
            onClick={(e) => onShapeClick?.(e, shape.id)}
            onDblClick={() => onShapeDblClick?.(shape.id)}
            onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
            onDragMove={(e) => onShapeDragMove?.(e, shape.id, e.target.x(), e.target.y())}
            onDragEnd={() => onShapeDragEnd?.(shape.id)}
          />
        );

      case "frame":
        return (
          <Fragment key={shape.id}>
            <Rect
              key={shape.id}
              id={shape.id}
              {...commonProps}
              width={shape.width}
              height={shape.height}
              draggable={draggable}
              onClick={(e) => onShapeClick?.(e, shape.id)}
              onDblClick={() => onShapeDblClick?.(shape.id)}
              onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
              onDragMove={(e) => onShapeDragMove?.(e, shape.id, e.target.x(), e.target.y())}
              onDragEnd={() => onShapeDragEnd?.(shape.id)}
            />
            <Text
              key={`${shape.id}-name`}
              x={shape.x}
              y={shape.y - 18}
              text={shape.name ?? ""}
              fontSize={12}
              fill="#64748b"
              listening={false}
            />
          </Fragment>
        );

      case "ellipse":
        return (
          <Ellipse
            key={shape.id}
            id={shape.id}
            x={shape.x + shape.width / 2}
            y={shape.y + shape.height / 2}
            radiusX={shape.width / 2}
            radiusY={shape.height / 2}
            rotation={commonProps.rotation}
            fill={commonProps.fill}
            stroke={commonProps.stroke}
            strokeWidth={commonProps.strokeWidth}
            opacity={commonProps.opacity}
            draggable={draggable}
            onClick={(e) => onShapeClick?.(e, shape.id)}
            onDblClick={() => onShapeDblClick?.(shape.id)}
            onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
            onDragMove={(e) => {
              const cx = e.target.x();
              const cy = e.target.y();
              onShapeDragMove?.(e, shape.id, cx - shape.width / 2, cy - shape.height / 2);
            }}
            onDragEnd={() => onShapeDragEnd?.(shape.id)}
          />
        );

      case "diamond":
        return (
          <Rect
            key={shape.id}
            id={shape.id}
            {...commonProps}
            width={shape.width}
            height={shape.height}
            draggable={draggable}
            onClick={(e) => onShapeClick?.(e, shape.id)}
            onDblClick={() => onShapeDblClick?.(shape.id)}
            onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
            onDragMove={(e) => onShapeDragMove?.(e, shape.id, e.target.x(), e.target.y())}
            onDragEnd={() => onShapeDragEnd?.(shape.id)}
          />
        );

      case "text":
        if (isEditingThis) return null;
        return (
          <Text
            key={shape.id}
            id={shape.id}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            text={shape.text?.content ?? ""}
            fontSize={shape.text?.fontSize ?? 12}
            fontFamily={shape.text?.fontFamily ?? "Arial"}
            fill={shape.text?.color ?? "#000000"}
            align={shape.text?.align ?? "left"}
            verticalAlign="top"
            rotation={commonProps.rotation}
            opacity={commonProps.opacity}
            draggable={draggable}
            onClick={(e) => onShapeClick?.(e, shape.id)}
            onDblClick={() => onShapeDblClick?.(shape.id)}
            onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
            onDragMove={(e) => onShapeDragMove?.(e, shape.id, e.target.x(), e.target.y())}
            onDragEnd={() => onShapeDragEnd?.(shape.id)}
          />
        );

      default:
        return null;
    }
  })();

  if (!shapeNode) return null;

  const nodes: React.ReactNode[] = [shapeNode];

  if (!isEditingThis && shape.type !== "text" && shape.text?.content) {
    const labelBounds = getShapeBounds(doc, shape);
    nodes.push(
      <Text
        key={`${shape.id}-label`}
        x={labelBounds.x}
        y={labelBounds.y}
        width={labelBounds.width}
        height={labelBounds.height}
        text={shape.text.content}
        fontSize={shape.text.fontSize ?? 12}
        fontFamily={shape.text.fontFamily ?? "Arial"}
        fill={shape.text.color ?? "#000000"}
        align={shape.text.align ?? "center"}
        verticalAlign="middle"
        fontStyle={shape.text.bold ? "bold" : "normal"}
        rotation={commonProps.rotation}
        listening={false}
      />
    );
  }

  if (isSelected) {
    const attachedToTransformer = !readOnly && !shape.locked;
    if (!attachedToTransformer) {
      const bounds = getShapeBounds(doc, shape);
      const outlineNode =
        shape.type === "ellipse" ? (
          <Ellipse
            key={`${shape.id}-select`}
            x={bounds.x + bounds.width / 2}
            y={bounds.y + bounds.height / 2}
            radiusX={bounds.width / 2 + 3}
            radiusY={bounds.height / 2 + 3}
            stroke="#4f46e5"
            strokeWidth={2}
            dash={[4, 4]}
            listening={false}
          />
        ) : (
          <Rect
            key={`${shape.id}-select`}
            x={bounds.x - 2}
            y={bounds.y - 2}
            width={bounds.width + 4}
            height={bounds.height + 4}
            stroke="#4f46e5"
            strokeWidth={2}
            dash={[4, 4]}
            listening={false}
          />
        );
      nodes.push(outlineNode);
    }
  }

  return nodes;
}

export function FreeformRenderer({ source, onChange, readOnly }: Props) {
  const [doc, setDoc] = useState<CanvasDocument>(() => {
    const { doc: parsed, errors } = parseFreeformSource(source);
    if (errors.length > 0) return parsed;
    return parsed.shapes.length > 0 ? parsed : FIXTURE_DOCUMENT;
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<ToolMode>("select");
  const [arrowDraft, setArrowDraft] = useState<ArrowDraft | null>(null);
  const [snapGuides, setSnapGuides] = useState<{ v: number | null; h: number | null }>({ v: null, h: null });
  const [placeKind, setPlaceKind] = useState<ShapeKind | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 });
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);

  const isApplyingRef = useRef(false);
  const lastSourceRef = useRef(source);
  const stageRef = useRef<Konva.Stage>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  const snapCandidatesRef = useRef<SnapCandidates>({ verticals: [], horizontals: [] });
  const modeRef = useRef<ToolMode>(mode);
  const placeKindRef = useRef<ShapeKind | null>(null);
  const dragDocRef = useRef<CanvasDocument | null>(null);
  const suppressNextClickRef = useRef(false);
  const spaceHeldRef = useRef(false);
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  // Whole-gesture bookkeeping lives in refs, written synchronously in the
  // handler that starts the gesture. Same-event-burst dragmove/mouseup/dragend
  // calls can fire before React flushes a setState from the previous handler
  // in the burst, so any handler that only reads the state copy can see a
  // stale (often still-null) value and silently no-op — the class of bug that
  // broke fast drags. `marquee`/`arrowDraft` React state still exists purely
  // to drive the live overlay rendering; all gating/logic reads the ref.
  const dragStateRef = useRef<{
    shapeId: string;
    startX: number;
    startY: number;
    initialPositions: Map<string, { x: number; y: number }>;
    directIds: Set<string>;
  } | null>(null);
  const marqueeRef = useRef<MarqueeState | null>(null);
  const arrowDraftRef = useRef<ArrowDraft | null>(null);

  const setModeSynced = (next: ToolMode) => {
    modeRef.current = next;
    setMode(next);
    if (next !== "place") {
      placeKindRef.current = null;
      setPlaceKind(null);
    }
  };

  const enterPlaceMode = (kind: ShapeKind) => {
    placeKindRef.current = kind;
    setPlaceKind(kind);
    setModeSynced("place");
  };

  // Sync external source prop to local state
  useEffect(() => {
    if (source === lastSourceRef.current) return;
    isApplyingRef.current = true;
    const { doc: parsed, errors } = parseFreeformSource(source);
    if (errors.length === 0) {
      const newDoc = parsed.shapes.length > 0 ? parsed : FIXTURE_DOCUMENT;
      setDoc(newDoc);
      const ids = new Set(newDoc.shapes.map((s) => s.id));
      setSelectedIds((prev) => new Set([...prev].filter((id) => ids.has(id))));
    }
    lastSourceRef.current = source;
    queueMicrotask(() => {
      isApplyingRef.current = false;
    });
  }, [source]);

  // Commit changes to onChange
  const commitChanges = (newDoc: CanvasDocument) => {
    if (readOnly) return;
    const serialized = serializeFreeformDocument(newDoc);
    if (serialized !== lastSourceRef.current) {
      lastSourceRef.current = serialized;
      onChange?.(serialized);
    }
  };

  useEffect(() => {
    if (!editingShapeId) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editingShapeId]);

  const startEditing = (shapeId: string) => {
    if (readOnly || modeRef.current === "arrow") return;
    const shape = doc.shapes.find((s) => s.id === shapeId);
    if (!shape || shape.type === "arrow" || shape.type === "line" || shape.locked) return;
    setSelectedIds(new Set());
    setEditingShapeId(shapeId);
    setEditingValue(shape.text?.content ?? "");
  };

  const insertShapeAt = (kind: ShapeKind, cx: number, cy: number) => {
    const { width, height } = defaultSizeFor(kind);
    const x = Math.round(cx - width / 2);
    const y = Math.round(cy - height / 2);
    const baseDoc = docRef.current;
    const id = generateShapeId(kind === "frame" ? "f" : kind.slice(0, 1));

    const newShape: CanvasShape =
      kind === "frame"
        ? { id, type: "frame", x, y, width, height, name: nextFrameName(baseDoc) }
        : kind === "text"
          ? { id, type: "text", x, y, width, height, text: { content: "", fontSize: 14, align: "left" } }
          : { id, type: kind, x, y, width, height, stroke: "#334155", strokeWidth: 2 };

    const newDoc = { ...baseDoc, shapes: [...baseDoc.shapes, newShape] };
    setDoc(newDoc);
    commitChanges(newDoc);
    setSelectedIds(new Set([id]));
    setModeSynced("select");

    if (kind === "text") {
      setEditingShapeId(id);
      setEditingValue("");
    }
  };

  const commitEditing = (cancel: boolean) => {
    const shapeId = editingShapeId;
    if (!shapeId) return;
    setEditingShapeId(null);
    if (cancel) return;

    const shape = doc.shapes.find((s) => s.id === shapeId);
    if (!shape) return;
    const content = editingValue;

    if (content === "") {
      if (shape.type === "text") {
        const newShapes = doc.shapes.filter((s) => s.id !== shapeId);
        const newDoc = { ...doc, shapes: newShapes };
        setDoc(newDoc);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(shapeId);
          return next;
        });
        commitChanges(newDoc);
        return;
      }

      const newShapes = doc.shapes.map((s) => {
        if (s.id !== shapeId) return s;
        const { text: _text, ...rest } = s;
        return rest as CanvasShape;
      });
      const newDoc = { ...doc, shapes: newShapes };
      setDoc(newDoc);
      commitChanges(newDoc);
      return;
    }

    const newShapes = doc.shapes.map((s) => {
      if (s.id !== shapeId) return s;
      const textBlock = { ...(s.text ?? { content: "" }), content };
      const updated = { ...s, text: textBlock };
      if (s.type === "text") {
        const lines = content.split("\n");
        const fontSize = textBlock.fontSize ?? 12;
        const longest = Math.max(...lines.map((l) => l.length));
        const width = Math.max(40, Math.round(longest * fontSize * 0.6 * 1.15));
        const height = Math.round(lines.length * fontSize * 1.4);
        return { ...updated, width, height };
      }
      return updated;
    });
    const newDoc = { ...doc, shapes: newShapes };
    setDoc(newDoc);
    commitChanges(newDoc);
  };

  // Keyboard handlers
  useEffect(() => {
    if (readOnly || selectedIds.size === 0 || editingShapeId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const newShapes = doc.shapes.filter((s) => !selectedIds.has(s.id));
        const newDoc = { ...doc, shapes: newShapes };
        setDoc(newDoc);
        setSelectedIds(new Set());
        commitChanges(newDoc);
        return;
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 1;
        const deltaMap = {
          ArrowUp: { dx: 0, dy: -delta },
          ArrowDown: { dx: 0, dy: delta },
          ArrowLeft: { dx: -delta, dy: 0 },
          ArrowRight: { dx: delta, dy: 0 },
        };
        const { dx, dy } = deltaMap[e.key as keyof typeof deltaMap];

        const newShapes = doc.shapes.map((s) => {
          if (selectedIds.has(s.id) && s.type !== "arrow" && s.type !== "line" && "x" in s && "y" in s) {
            return { ...s, x: s.x + dx, y: s.y + dy };
          }
          return s;
        });
        const newDoc = { ...doc, shapes: newShapes };
        setDoc(newDoc);
        commitChanges(newDoc);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [doc, selectedIds, readOnly, editingShapeId]);

  // Tool-mode shortcuts: v = select, a = arrow, r/o/d/s/t/f = place shape, 0 = reset zoom
  useEffect(() => {
    if (readOnly) return;

    const handleModeKeyDown = (e: KeyboardEvent) => {
      if (editingShapeId) return;
      const activeElement = document.activeElement;
      if (activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA") return;

      if (e.key === "Escape") {
        if (modeRef.current !== "select") {
          arrowDraftRef.current = null;
          setArrowDraft(null);
          setModeSynced("select");
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case "v":
          setModeSynced("select");
          break;
        case "a":
          setModeSynced("arrow");
          break;
        case "r":
          enterPlaceMode("rectangle");
          break;
        case "o":
          enterPlaceMode("ellipse");
          break;
        case "d":
          enterPlaceMode("diamond");
          break;
        case "s":
          enterPlaceMode("sticky");
          break;
        case "t":
          enterPlaceMode("text");
          break;
        case "f":
          enterPlaceMode("frame");
          break;
        case "0":
          setViewport({ scale: 1, x: 0, y: 0 });
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleModeKeyDown);
    return () => window.removeEventListener("keydown", handleModeKeyDown);
  }, [readOnly, editingShapeId]);

  // Space-hold enables pan-drag
  useEffect(() => {
    if (readOnly) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || editingShapeId) return;
      const activeElement = document.activeElement;
      if (activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA") return;
      e.preventDefault();
      spaceHeldRef.current = true;
      setIsSpaceHeld(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      spaceHeldRef.current = false;
      setIsSpaceHeld(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [readOnly, editingShapeId]);

  const handleShapeClick = (e: Konva.KonvaEventObject<MouseEvent>, shapeId: string) => {
    if (readOnly || modeRef.current === "arrow") return;
    if (e.evt.shiftKey) {
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(shapeId)) {
          newSet.delete(shapeId);
        } else {
          newSet.add(shapeId);
        }
        return newSet;
      });
    } else {
      setSelectedIds(new Set([shapeId]));
    }
  };

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (readOnly) return;
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    if (modeRef.current === "place") {
      const stage = e.target.getStage();
      const pos = stagePointFromEvent(stage);
      if (!pos) return;
      const kind = placeKindRef.current;
      if (!kind) {
        setModeSynced("select");
        return;
      }
      insertShapeAt(kind, pos.x, pos.y);
      return;
    }
    if (modeRef.current === "arrow") return;
    if (e.target === e.target.getStage()) {
      setSelectedIds(new Set());
    }
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (readOnly) return;

    if (spaceHeldRef.current || e.evt.button === 1) {
      e.evt.preventDefault();
      panRef.current = {
        startX: e.evt.clientX,
        startY: e.evt.clientY,
        originX: viewportRef.current.x,
        originY: viewportRef.current.y,
      };
      return;
    }

    if (modeRef.current === "place") return;

    if (modeRef.current === "arrow") {
      const stage = e.target.getStage();
      const pos = stagePointFromEvent(stage);
      if (!pos) return;
      const startBinding = getShapeIdAtPointer(docRef.current, stage);
      const draft: ArrowDraft = { startPoint: pos, startBinding, currentPoint: pos, hoverShapeId: null };
      arrowDraftRef.current = draft;
      setArrowDraft(draft);
      return;
    }

    if (marqueeRef.current !== null) return;
    if (e.target !== e.target.getStage()) return;

    const pos = stagePointFromEvent(e.target.getStage());
    if (!pos) return;

    marqueeStartRef.current = { x: pos.x, y: pos.y };
    const draft: MarqueeState = { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y };
    marqueeRef.current = draft;
    setMarquee(draft);
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (panRef.current) {
      const pan = panRef.current;
      const dx = e.evt.clientX - pan.startX;
      const dy = e.evt.clientY - pan.startY;
      setViewport((prev) => ({ ...prev, x: pan.originX + dx, y: pan.originY + dy }));
      return;
    }

    if (modeRef.current === "arrow") {
      const current = arrowDraftRef.current;
      if (!current) return;
      const stage = e.target.getStage();
      const pos = stagePointFromEvent(stage);
      if (!pos) return;
      const hoverShapeId = getShapeIdAtPointer(docRef.current, stage);
      const draft: ArrowDraft = { ...current, currentPoint: pos, hoverShapeId };
      arrowDraftRef.current = draft;
      setArrowDraft(draft);
      return;
    }

    const current = marqueeRef.current;
    if (!marqueeStartRef.current || !current) return;

    const pos = stagePointFromEvent(e.target.getStage());
    if (!pos) return;

    const draft: MarqueeState = { ...current, x1: pos.x, y1: pos.y };
    marqueeRef.current = draft;
    setMarquee(draft);
  };

  const handleStageMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (panRef.current) {
      panRef.current = null;
      return;
    }

    if (modeRef.current === "arrow") {
      const draft = arrowDraftRef.current;
      if (!draft) return;
      const stage = e.target.getStage();
      const pos = stagePointFromEvent(stage) ?? draft.currentPoint;
      const endBinding = getShapeIdAtPointer(docRef.current, stage);
      const dist = Math.hypot(pos.x - draft.startPoint.x, pos.y - draft.startPoint.y);

      arrowDraftRef.current = null;
      setArrowDraft(null);
      setModeSynced("select");
      suppressNextClickRef.current = true;

      if (dist < 8 && !draft.startBinding && !endBinding) return;

      const sameShape = !!draft.startBinding && !!endBinding && draft.startBinding === endBinding;
      const start = draft.startBinding
        ? { shapeId: draft.startBinding, anchor: "auto" as const }
        : { x: draft.startPoint.x, y: draft.startPoint.y };
      const end = endBinding && !sameShape ? { shapeId: endBinding, anchor: "auto" as const } : { x: pos.x, y: pos.y };

      const newArrow: ArrowShape = {
        id: generateShapeId("a"),
        type: "arrow",
        x: 0,
        y: 0,
        start,
        end,
        stroke: "#64748b",
        strokeWidth: 2,
      };
      const baseDoc = docRef.current;
      const newDoc = { ...baseDoc, shapes: [...baseDoc.shapes, newArrow] };
      setDoc(newDoc);
      commitChanges(newDoc);
      setSelectedIds(new Set([newArrow.id]));
      return;
    }

    const finalMarquee = marqueeRef.current;
    if (!finalMarquee || !marqueeStartRef.current) {
      marqueeStartRef.current = null;
      marqueeRef.current = null;
      return;
    }

    const marqueeRect = {
      x: Math.min(finalMarquee.x0, finalMarquee.x1),
      y: Math.min(finalMarquee.y0, finalMarquee.y1),
      width: Math.abs(finalMarquee.x1 - finalMarquee.x0),
      height: Math.abs(finalMarquee.y1 - finalMarquee.y0),
    };

    const baseDoc = docRef.current;
    const selected = new Set<string>();
    for (const shape of baseDoc.shapes) {
      if (shape.type === "arrow" || shape.type === "line") continue;
      const bounds = getShapeBounds(baseDoc, shape);
      if (aabbOverlap(marqueeRect, bounds)) {
        selected.add(shape.id);
      }
    }

    setSelectedIds(selected);
    marqueeRef.current = null;
    setMarquee(null);
    marqueeStartRef.current = null;
  };

  const handleShapeDragStart = (shapeId: string, x: number, y: number) => {
    if (readOnly) return;
    const idsToMove = new Set<string>();
    const directIds = new Set<string>();

    if (selectedIds.has(shapeId)) {
      // Move all selected shapes
      for (const shape of doc.shapes) {
        if (selectedIds.has(shape.id) && shape.type !== "arrow" && shape.type !== "line") {
          idsToMove.add(shape.id);
          directIds.add(shape.id);
        }
      }
    } else {
      // Single shape drag
      idsToMove.add(shapeId);
      directIds.add(shapeId);
      setSelectedIds(new Set([shapeId]));
    }

    // Dragging a frame moves its children with it
    for (const id of Array.from(idsToMove)) {
      const shape = doc.shapes.find((s) => s.id === id);
      if (shape?.type !== "frame") continue;
      for (const child of doc.shapes) {
        if (child.frameId === id && child.type !== "arrow" && child.type !== "line") {
          idsToMove.add(child.id);
        }
      }
    }

    const initialPositions = new Map<string, { x: number; y: number }>();
    for (const id of idsToMove) {
      const shape = doc.shapes.find((s) => s.id === id);
      if (shape) initialPositions.set(id, { x: shape.x, y: shape.y });
    }

    dragStateRef.current = {
      shapeId,
      startX: x,
      startY: y,
      initialPositions,
      directIds,
    };
    dragDocRef.current = docRef.current;

    const verticals: number[] = [];
    const horizontals: number[] = [];
    for (const s of docRef.current.shapes) {
      if (s.type === "arrow" || s.type === "line") continue;
      if (initialPositions.has(s.id)) continue;
      const b = getShapeBounds(docRef.current, s);
      verticals.push(b.x, b.x + b.width / 2, b.x + b.width);
      horizontals.push(b.y, b.y + b.height / 2, b.y + b.height);
    }
    snapCandidatesRef.current = { verticals, horizontals };
  };

  const handleShapeDragMove = (e: Konva.KonvaEventObject<DragEvent>, shapeId: string, x: number, y: number) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;
    const baseDoc = dragDocRef.current ?? docRef.current;

    let dx = x - dragState.startX;
    let dy = y - dragState.startY;

    let selLeft = Infinity;
    let selRight = -Infinity;
    let selTop = Infinity;
    let selBottom = -Infinity;
    for (const [id, initial] of dragState.initialPositions) {
      const shape = baseDoc.shapes.find((s) => s.id === id);
      if (!shape || shape.type === "arrow" || shape.type === "line") continue;
      const w = "width" in shape ? shape.width : 0;
      const h = "height" in shape ? shape.height : 0;
      const nx = initial.x + dx;
      const ny = initial.y + dy;
      selLeft = Math.min(selLeft, nx);
      selRight = Math.max(selRight, nx + w);
      selTop = Math.min(selTop, ny);
      selBottom = Math.max(selBottom, ny + h);
    }
    const selCenterX = (selLeft + selRight) / 2;
    const selCenterY = (selTop + selBottom) / 2;

    let bestVDiff = SNAP_THRESHOLD;
    let snapDx = 0;
    let vLine: number | null = null;
    for (const v of snapCandidatesRef.current.verticals) {
      for (const edge of [selLeft, selCenterX, selRight]) {
        const diff = Math.abs(edge - v);
        if (diff < bestVDiff) {
          bestVDiff = diff;
          snapDx = v - edge;
          vLine = v;
        }
      }
    }

    let bestHDiff = SNAP_THRESHOLD;
    let snapDy = 0;
    let hLine: number | null = null;
    for (const h of snapCandidatesRef.current.horizontals) {
      for (const edge of [selTop, selCenterY, selBottom]) {
        const diff = Math.abs(edge - h);
        if (diff < bestHDiff) {
          bestHDiff = diff;
          snapDy = h - edge;
          hLine = h;
        }
      }
    }

    dx += snapDx;
    dy += snapDy;
    setSnapGuides({ v: vLine, h: hLine });

    const newShapes = baseDoc.shapes.map((s) => {
      const initial = dragState.initialPositions.get(s.id);
      if (initial) {
        return { ...s, x: initial.x + dx, y: initial.y + dy };
      }
      return s;
    });

    const newDoc = { ...baseDoc, shapes: newShapes };
    dragDocRef.current = newDoc;
    setDoc(newDoc);

    const updatedShape = newShapes.find((s) => s.id === shapeId);
    if (updatedShape && "width" in updatedShape && "height" in updatedShape) {
      const nodeX = updatedShape.type === "ellipse" ? updatedShape.x + updatedShape.width / 2 : updatedShape.x;
      const nodeY = updatedShape.type === "ellipse" ? updatedShape.y + updatedShape.height / 2 : updatedShape.y;
      e.target.position({ x: nodeX, y: nodeY });
    }
  };

  const handleShapeDragEnd = () => {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    // Commit the final (possibly snapped) position exactly once, from the
    // ref updated synchronously in handleShapeDragMove — not from `doc` state,
    // which may not have caught up to the last dragmove yet (same-event-burst
    // gestures can fire dragmove/dragend before React flushes in between).
    let finalDoc = dragDocRef.current ?? docRef.current;

    // Directly-dragged (non-frame) shapes join/leave a frame based on where
    // their center lands; children dragged along with a frame keep their
    // membership as-is.
    const reassignments = new Map<string, string | null>();
    for (const id of dragState.directIds) {
      const shape = finalDoc.shapes.find((s) => s.id === id);
      if (!shape || shape.type === "frame" || shape.type === "arrow" || shape.type === "line") continue;
      const bounds = getShapeBounds(finalDoc, shape);
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      const newFrameId = frameContaining(finalDoc, cx, cy);
      const currentFrameId = shape.frameId ?? null;
      if (newFrameId !== currentFrameId) reassignments.set(id, newFrameId);
    }
    if (reassignments.size > 0) {
      const shapes = finalDoc.shapes.map((s) =>
        reassignments.has(s.id) ? { ...s, frameId: reassignments.get(s.id) ?? null } : s
      );
      finalDoc = { ...finalDoc, shapes };
    }

    commitChanges(finalDoc);
    if (finalDoc !== docRef.current) setDoc(finalDoc);
    dragDocRef.current = null;
    dragStateRef.current = null;
    setSnapGuides({ v: null, h: null });
  };

  useEffect(() => {
    if (readOnly) return;
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;

    if (editingShapeId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }

    const eligibleIds = Array.from(selectedIds).filter((id) => {
      const shape = docRef.current.shapes.find((s) => s.id === id);
      return !!shape && shape.type !== "arrow" && shape.type !== "line" && !shape.locked;
    });
    const nodes = eligibleIds
      .map((id) => stage.findOne(`#${id}`))
      .filter((node): node is Konva.Node => !!node);

    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, readOnly, editingShapeId]);

  const handleTransformEnd = () => {
    const tr = transformerRef.current;
    if (!tr) return;

    const updates = new Map<string, { x: number; y: number; width: number; height: number; rotation: number }>();
    for (const node of tr.nodes()) {
      const shape = doc.shapes.find((s) => s.id === node.id());
      if (!shape || shape.type === "arrow" || shape.type === "line") continue;

      const width = Math.round(node.width() * node.scaleX());
      const height = Math.round(node.height() * node.scaleY());
      const rotation = Math.round(node.rotation());
      node.scaleX(1);
      node.scaleY(1);

      if (shape.type === "ellipse") {
        const cx = Math.round(node.x());
        const cy = Math.round(node.y());
        updates.set(shape.id, { x: cx - width / 2, y: cy - height / 2, width, height, rotation });
      } else {
        updates.set(shape.id, { x: Math.round(node.x()), y: Math.round(node.y()), width, height, rotation });
      }
    }

    if (updates.size === 0) return;

    const newShapes = doc.shapes.map((s) => {
      if (s.type === "arrow" || s.type === "line") return s;
      const u = updates.get(s.id);
      if (!u) return s;
      return { ...s, x: u.x, y: u.y, width: u.width, height: u.height, rotation: u.rotation };
    });
    const newDoc = { ...doc, shapes: newShapes };
    setDoc(newDoc);
    commitChanges(newDoc);
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    if (e.evt.ctrlKey) {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      setViewport((prev) => {
        const mousePointTo = {
          x: (pointer.x - prev.x) / prev.scale,
          y: (pointer.y - prev.y) / prev.scale,
        };
        const rawScale = e.evt.deltaY > 0 ? prev.scale / ZOOM_FACTOR : prev.scale * ZOOM_FACTOR;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));
        return {
          scale: newScale,
          x: pointer.x - mousePointTo.x * newScale,
          y: pointer.y - mousePointTo.y * newScale,
        };
      });
    } else {
      setViewport((prev) => ({ ...prev, x: prev.x - e.evt.deltaX, y: prev.y - e.evt.deltaY }));
    }
  };

  const marqueeRect = marquee
    ? {
        x: Math.min(marquee.x0, marquee.x1),
        y: Math.min(marquee.y0, marquee.y1),
        width: Math.abs(marquee.x1 - marquee.x0),
        height: Math.abs(marquee.y1 - marquee.y0),
      }
    : null;

  const editingShape = editingShapeId ? doc.shapes.find((s) => s.id === editingShapeId) : null;
  const editingRect = editingShape ? getShapeBounds(doc, editingShape) : null;
  const stageContainerRect = editingShape ? stageRef.current?.container().getBoundingClientRect() : null;
  const hoverShape = arrowDraft?.hoverShapeId ? doc.shapes.find((s) => s.id === arrowDraft.hoverShapeId) : null;
  const hoverBounds = hoverShape ? getShapeBounds(doc, hoverShape) : null;

  const toolbarButton = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-indigo-600 text-white"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );

  const orderedShapes = [
    ...doc.shapes.filter((s) => s.type === "frame"),
    ...doc.shapes.filter((s) => s.type !== "frame"),
  ];

  return (
    <div className="w-full h-full relative">
      {!readOnly && (
        <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1 rounded-md border border-slate-200 bg-white/95 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900/95 max-w-[240px]">
          {toolbarButton("Select", mode === "select", () => setModeSynced("select"))}
          {toolbarButton("Arrow", mode === "arrow", () => setModeSynced("arrow"))}
          {toolbarButton("Rectangle", mode === "place" && placeKind === "rectangle", () => enterPlaceMode("rectangle"))}
          {toolbarButton("Ellipse", mode === "place" && placeKind === "ellipse", () => enterPlaceMode("ellipse"))}
          {toolbarButton("Diamond", mode === "place" && placeKind === "diamond", () => enterPlaceMode("diamond"))}
          {toolbarButton("Sticky", mode === "place" && placeKind === "sticky", () => enterPlaceMode("sticky"))}
          {toolbarButton("Text", mode === "place" && placeKind === "text", () => enterPlaceMode("text"))}
          {toolbarButton("Frame", mode === "place" && placeKind === "frame", () => enterPlaceMode("frame"))}
        </div>
      )}

      <Stage
        ref={stageRef}
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        x={viewport.x}
        y={viewport.y}
        style={{ cursor: isSpaceHeld ? "grab" : undefined }}
        onClick={handleStageClick}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onWheel={handleWheel}
      >
        <Layer>
          {orderedShapes.map((shape) =>
            renderShape(
              shape,
              doc,
              selectedIds.has(shape.id),
              handleShapeClick,
              handleShapeDragStart,
              handleShapeDragMove,
              handleShapeDragEnd,
              readOnly,
              startEditing,
              editingShapeId,
              mode
            )
          )}

          {marqueeRect && (
            <Rect
              x={marqueeRect.x}
              y={marqueeRect.y}
              width={marqueeRect.width}
              height={marqueeRect.height}
              fill="rgba(79,70,229,0.1)"
              stroke="#4f46e5"
              strokeWidth={1}
              listening={false}
            />
          )}

          {snapGuides.v !== null && (
            <Line
              points={[snapGuides.v, 0, snapGuides.v, STAGE_HEIGHT]}
              stroke="#f59e0b"
              strokeWidth={1}
              dash={[4, 4]}
              listening={false}
            />
          )}
          {snapGuides.h !== null && (
            <Line
              points={[0, snapGuides.h, STAGE_WIDTH, snapGuides.h]}
              stroke="#f59e0b"
              strokeWidth={1}
              dash={[4, 4]}
              listening={false}
            />
          )}

          {!readOnly && (
            <Transformer
              ref={transformerRef}
              rotateEnabled={true}
              anchorStroke="#6366f1"
              anchorFill="#ffffff"
              borderStroke="#6366f1"
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 8 || newBox.height < 8) return oldBox;
                return newBox;
              }}
              onTransformEnd={handleTransformEnd}
            />
          )}
        </Layer>

        <Layer listening={false}>
          {arrowDraft && (
            <Line
              points={[
                arrowDraft.startPoint.x,
                arrowDraft.startPoint.y,
                arrowDraft.currentPoint.x,
                arrowDraft.currentPoint.y,
              ]}
              stroke="#6366f1"
              strokeWidth={2}
              dash={[6, 4]}
            />
          )}
          {hoverBounds &&
            (hoverShape?.type === "ellipse" ? (
              <Ellipse
                x={hoverBounds.x + hoverBounds.width / 2}
                y={hoverBounds.y + hoverBounds.height / 2}
                radiusX={hoverBounds.width / 2 + 3}
                radiusY={hoverBounds.height / 2 + 3}
                stroke="#6366f1"
                strokeWidth={2}
                dash={[4, 4]}
              />
            ) : (
              <Rect
                x={hoverBounds.x - 3}
                y={hoverBounds.y - 3}
                width={hoverBounds.width + 6}
                height={hoverBounds.height + 6}
                stroke="#6366f1"
                strokeWidth={2}
                dash={[4, 4]}
              />
            ))}
        </Layer>
      </Stage>

      {editingShape && editingRect && (
        <textarea
          ref={textareaRef}
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => commitEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              commitEditing(true);
            } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commitEditing(false);
            }
            e.stopPropagation();
          }}
          style={{
            position: "fixed",
            left: (stageContainerRect?.left ?? 0) + viewport.x + editingRect.x * viewport.scale,
            top: (stageContainerRect?.top ?? 0) + viewport.y + editingRect.y * viewport.scale,
            width: editingRect.width * viewport.scale,
            height: editingRect.height * viewport.scale,
            fontSize: (editingShape.text?.fontSize ?? 12) * viewport.scale,
            fontFamily: editingShape.text?.fontFamily ?? "Arial",
            color: editingShape.text?.color ?? "#000000",
            textAlign: editingShape.text?.align ?? (editingShape.type === "text" ? "left" : "center"),
            fontWeight: editingShape.text?.bold ? "bold" : "normal",
            background: "rgba(255,255,255,0.95)",
            border: "1px solid #4f46e5",
            outline: "none",
            resize: "none",
            padding: 2,
            margin: 0,
            boxSizing: "border-box",
            zIndex: 50,
          }}
        />
      )}
    </div>
  );
}
