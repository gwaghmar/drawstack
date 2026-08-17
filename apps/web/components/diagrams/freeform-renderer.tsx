"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Ellipse, Line, Arrow, Text, Transformer, Shape, Path, Group } from "react-konva";
import Konva from "konva";
import rough from "roughjs";
import { getStroke } from "perfect-freehand";
import {
  parseFreeformSource,
  serializeFreeformDocument,
  resolveArrowRenderEndpoints,
  getShapeBounds,
  generateShapeId,
  resolveColor,
  type CanvasDocument,
  type CanvasShape,
  type ArrowShape,
  type PathShape,
  type RectShape,
  type DiamondShape,
  type TriangleShape,
  type CylinderShape,
  type CloudShape,
  type HexagonShape,
  type StarShape,
  type StickyShape,
  type TextShape,
  type FrameShape,
} from "@/lib/diagrams/freeform-canvas";

import { freeformToSvg } from "@/lib/diagrams/freeform-svg";

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

type ToolMode = "select" | "draw" | "arrow" | "place";

type ShapeKind =
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "triangle"
  | "cylinder"
  | "cloud"
  | "hexagon"
  | "star"
  | "sticky"
  | "text"
  | "frame";

type ArrowDraft = {
  startPoint: { x: number; y: number };
  startBinding: string | null;
  currentPoint: { x: number; y: number };
  hoverShapeId: string | null;
};

type DrawDraft = {
  points: [number, number][];
  stroke: string;
  strokeWidth: number;
};

type SnapCandidates = { verticals: number[]; horizontals: number[] };

type Viewport = { scale: number; x: number; y: number };

const STAGE_WIDTH = 960;
const STAGE_HEIGHT = 600;
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
  if (shape.fill) return resolveColor(shape.fill) ?? shape.fill;
  if (shape.type === "sticky") return "#fef08a";
  if (shape.type === "frame") return "transparent";
  return "#ffffff";
}

function defaultStroke(shape: CanvasShape): string {
  if (shape.stroke) return resolveColor(shape.stroke) ?? shape.stroke;
  if (shape.type === "frame") return "#94a3b8";
  return "#1e293b";
}

function defaultSizeFor(kind: ShapeKind): { width: number; height: number } {
  switch (kind) {
    case "sticky":
      return { width: 180, height: 180 };
    case "text":
      return { width: 140, height: 36 };
    case "frame":
      return { width: 440, height: 320 };
    case "triangle":
      return { width: 160, height: 120 };
    case "cylinder":
      return { width: 160, height: 120 };
    case "cloud":
      return { width: 180, height: 110 };
    case "hexagon":
      return { width: 160, height: 110 };
    case "star":
      return { width: 130, height: 130 };
    case "diamond":
      return { width: 160, height: 100 };
    default:
      return { width: 160, height: 90 };
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

function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );
  d.push("Z");
  return d.join(" ");
}

function computeOrthogonalPoints(
  start: { x: number; y: number },
  end: { x: number; y: number }
): number[] {
  const midX = Math.round((start.x + end.x) / 2);
  return [start.x, start.y, midX, start.y, midX, end.y, end.x, end.y];
}

const FIXTURE_DOCUMENT: CanvasDocument = {
  version: 1,
  renderMode: "clean",
  shapes: [
    {
      id: "s1",
      type: "rectangle",
      x: 60,
      y: 80,
      width: 160,
      height: 90,
      fill: "5",
      stroke: "#2563eb",
      strokeWidth: 2,
      cornerRadius: 8,
      text: { content: "Client Request", fontSize: 14, color: "#1e293b", bold: true, align: "center" },
    },
    {
      id: "s2",
      type: "diamond",
      x: 300,
      y: 75,
      width: 150,
      height: 100,
      fill: "3",
      stroke: "#d97706",
      strokeWidth: 2,
      text: { content: "Authorized?", fontSize: 13, color: "#78350f", bold: true, align: "center" },
    },
    {
      id: "s3",
      type: "cylinder",
      x: 540,
      y: 70,
      width: 150,
      height: 110,
      fill: "4",
      stroke: "#16a34a",
      strokeWidth: 2,
      text: { content: "Database", fontSize: 14, color: "#14532d", bold: true, align: "center" },
    },
    {
      id: "a1",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "s1", anchor: "right" },
      end: { shapeId: "s2", anchor: "left" },
      stroke: "#64748b",
      strokeWidth: 2,
      label: "HTTP POST",
    },
    {
      id: "a2",
      type: "arrow",
      x: 0,
      y: 0,
      start: { shapeId: "s2", anchor: "right" },
      end: { shapeId: "s3", anchor: "left" },
      stroke: "#64748b",
      strokeWidth: 2,
      label: "Yes",
    },
  ],
};

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
  const draggable = !readOnly && mode === "select";
  const isSketchy = doc.renderMode === "sketchy";

  const strokeDash =
    shape.strokeDash === "dashed" ? [8, 6] : shape.strokeDash === "dotted" ? [3, 4] : undefined;

  const commonProps = {
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation ?? 0,
    fill: defaultFill(shape),
    stroke: defaultStroke(shape),
    strokeWidth: shape.strokeWidth ?? 2,
    opacity: shape.opacity ?? 1,
    dash: strokeDash,
  };

  // ─── Path (Freehand) ────────────────────────────────────────────────────────
  if (shape.type === "path") {
    const pathShape = shape as PathShape;
    const strokePoints = getStroke(pathShape.points, {
      size: (pathShape.strokeWidth ?? 2) * 3,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    });
    const svgPath = getSvgPathFromStroke(strokePoints);
    const strokeColor = defaultStroke(shape);

    return (
      <Path
        key={shape.id}
        id={shape.id}
        data={svgPath}
        fill={strokeColor}
        opacity={commonProps.opacity}
        draggable={draggable}
        listening={!readOnly}
        onClick={(e) => onShapeClick?.(e, shape.id)}
        onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
        onDragMove={(e) => onShapeDragMove?.(e, shape.id, e.target.x(), e.target.y())}
        onDragEnd={() => onShapeDragEnd?.(shape.id)}
      />
    );
  }

  // ─── Arrow & Line ──────────────────────────────────────────────────────────
  if (shape.type === "arrow" || shape.type === "line") {
    const arrowShape = shape as ArrowShape;
    const { start: startPoint, end: endPoint } = resolveArrowRenderEndpoints(doc, arrowShape);
    const stroke = isSelected ? "#4f46e5" : commonProps.stroke;

    let points: number[];
    if (arrowShape.routing === "orthogonal") {
      points = computeOrthogonalPoints(startPoint, endPoint);
    } else {
      points = [startPoint.x, startPoint.y, endPoint.x, endPoint.y];
    }

    const midX = Math.round((startPoint.x + endPoint.x) / 2);
    const midY = Math.round((startPoint.y + endPoint.y) / 2);

    const arrowNode =
      shape.type === "arrow" ? (
        <Arrow
          key={shape.id}
          id={shape.id}
          points={points}
          stroke={stroke}
          fill={stroke}
          strokeWidth={commonProps.strokeWidth}
          dash={strokeDash}
          opacity={commonProps.opacity}
          pointerLength={10}
          pointerWidth={10}
          pointerAtBeginning={arrowShape.arrowStart ?? false}
          pointerAtEnding={arrowShape.arrowEnd !== false}
          listening={!readOnly}
          onClick={(e) => onShapeClick?.(e, shape.id)}
        />
      ) : (
        <Line
          key={shape.id}
          id={shape.id}
          points={points}
          stroke={stroke}
          strokeWidth={commonProps.strokeWidth}
          dash={strokeDash}
          opacity={commonProps.opacity}
          listening={!readOnly}
          onClick={(e) => onShapeClick?.(e, shape.id)}
        />
      );

    const labelNode = arrowShape.label ? (
      <Group key={`${shape.id}-label-group`} x={midX} y={midY - 14} listening={false}>
        <Rect
          x={-Math.max(20, arrowShape.label.length * 4)}
          y={-2}
          width={Math.max(40, arrowShape.label.length * 8)}
          height={20}
          fill="#ffffff"
          cornerRadius={4}
          stroke="#cbd5e1"
          strokeWidth={1}
          opacity={0.9}
        />
        <Text
          x={-Math.max(20, arrowShape.label.length * 4)}
          y={2}
          width={Math.max(40, arrowShape.label.length * 8)}
          text={arrowShape.label}
          fontSize={11}
          fontFamily="Inter, Arial, sans-serif"
          fill="#475569"
          align="center"
        />
      </Group>
    ) : null;

    return (
      <Fragment key={shape.id}>
        {arrowNode}
        {labelNode}
      </Fragment>
    );
  }

  // ─── Geometric Shapes ──────────────────────────────────────────────────────
  const shapeNode = (() => {
    const w = (shape as RectShape).width;
    const h = (shape as RectShape).height;

    switch (shape.type) {
      case "rectangle":
      case "sticky":
        return (
          <Rect
            key={shape.id}
            id={shape.id}
            {...commonProps}
            width={w}
            height={h}
            cornerRadius={
              shape.type === "sticky" ? 4 : "cornerRadius" in shape ? shape.cornerRadius ?? 4 : 4
            }
            shadowColor={shape.type === "sticky" ? "#000000" : undefined}
            shadowBlur={shape.type === "sticky" ? 8 : 0}
            shadowOpacity={shape.type === "sticky" ? 0.12 : 0}
            shadowOffset={shape.type === "sticky" ? { x: 2, y: 3 } : undefined}
            draggable={draggable}
            onClick={(e) => onShapeClick?.(e, shape.id)}
            onDblClick={() => onShapeDblClick?.(shape.id)}
            onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
            onDragMove={(e) => onShapeDragMove?.(e, shape.id, e.target.x(), e.target.y())}
            onDragEnd={() => onShapeDragEnd?.(shape.id)}
          />
        );

      case "diamond":
        return (
          <Line
            key={shape.id}
            id={shape.id}
            {...commonProps}
            points={[w / 2, 0, w, h / 2, w / 2, h, 0, h / 2]}
            closed={true}
            draggable={draggable}
            onClick={(e) => onShapeClick?.(e, shape.id)}
            onDblClick={() => onShapeDblClick?.(shape.id)}
            onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
            onDragMove={(e) => onShapeDragMove?.(e, shape.id, e.target.x(), e.target.y())}
            onDragEnd={() => onShapeDragEnd?.(shape.id)}
          />
        );

      case "triangle":
        return (
          <Line
            key={shape.id}
            id={shape.id}
            {...commonProps}
            points={[w / 2, 0, w, h, 0, h]}
            closed={true}
            draggable={draggable}
            onClick={(e) => onShapeClick?.(e, shape.id)}
            onDblClick={() => onShapeDblClick?.(shape.id)}
            onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
            onDragMove={(e) => onShapeDragMove?.(e, shape.id, e.target.x(), e.target.y())}
            onDragEnd={() => onShapeDragEnd?.(shape.id)}
          />
        );

      case "cylinder":
        return (
          <Group
            key={shape.id}
            id={shape.id}
            x={shape.x}
            y={shape.y}
            rotation={commonProps.rotation}
            opacity={commonProps.opacity}
            draggable={draggable}
            onClick={(e) => onShapeClick?.(e, shape.id)}
            onDblClick={() => onShapeDblClick?.(shape.id)}
            onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
            onDragMove={(e) => onShapeDragMove?.(e, shape.id, e.target.x(), e.target.y())}
            onDragEnd={() => onShapeDragEnd?.(shape.id)}
          >
            {/* Body */}
            <Rect
              x={0}
              y={h * 0.15}
              width={w}
              height={h * 0.7}
              fill={commonProps.fill}
              stroke="transparent"
            />
            <Line points={[0, h * 0.15, 0, h * 0.85]} stroke={commonProps.stroke} strokeWidth={commonProps.strokeWidth} />
            <Line points={[w, h * 0.15, w, h * 0.85]} stroke={commonProps.stroke} strokeWidth={commonProps.strokeWidth} />
            {/* Bottom Cap */}
            <Ellipse
              x={w / 2}
              y={h * 0.85}
              radiusX={w / 2}
              radiusY={h * 0.15}
              fill={commonProps.fill}
              stroke={commonProps.stroke}
              strokeWidth={commonProps.strokeWidth}
            />
            {/* Top Cap */}
            <Ellipse
              x={w / 2}
              y={h * 0.15}
              radiusX={w / 2}
              radiusY={h * 0.15}
              fill={commonProps.fill}
              stroke={commonProps.stroke}
              strokeWidth={commonProps.strokeWidth}
            />
          </Group>
        );

      case "cloud": {
        const pathData = `M ${w * 0.25} ${h * 0.75} C ${w * 0.05} ${h * 0.75} ${w * 0.05} ${h * 0.35} ${w * 0.3} ${h * 0.35} C ${w * 0.35} ${h * 0.1} ${w * 0.65} ${h * 0.1} ${w * 0.7} ${h * 0.35} C ${w * 0.95} ${h * 0.35} ${w * 0.95} ${h * 0.75} ${w * 0.75} ${h * 0.75} Z`;
        return (
          <Path
            key={shape.id}
            id={shape.id}
            {...commonProps}
            data={pathData}
            draggable={draggable}
            onClick={(e) => onShapeClick?.(e, shape.id)}
            onDblClick={() => onShapeDblClick?.(shape.id)}
            onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
            onDragMove={(e) => onShapeDragMove?.(e, shape.id, e.target.x(), e.target.y())}
            onDragEnd={() => onShapeDragEnd?.(shape.id)}
          />
        );
      }

      case "hexagon":
        return (
          <Line
            key={shape.id}
            id={shape.id}
            {...commonProps}
            points={[w * 0.25, 0, w * 0.75, 0, w, h * 0.5, w * 0.75, h, w * 0.25, h, 0, h * 0.5]}
            closed={true}
            draggable={draggable}
            onClick={(e) => onShapeClick?.(e, shape.id)}
            onDblClick={() => onShapeDblClick?.(shape.id)}
            onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
            onDragMove={(e) => onShapeDragMove?.(e, shape.id, e.target.x(), e.target.y())}
            onDragEnd={() => onShapeDragEnd?.(shape.id)}
          />
        );

      case "star": {
        const cx = w / 2;
        const cy = h / 2;
        const outerR = Math.min(w, h) / 2;
        const innerR = outerR * 0.45;
        const starPoints: number[] = [];
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = (i * Math.PI) / 5 - Math.PI / 2;
          starPoints.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
        }
        return (
          <Line
            key={shape.id}
            id={shape.id}
            {...commonProps}
            points={starPoints}
            closed={true}
            draggable={draggable}
            onClick={(e) => onShapeClick?.(e, shape.id)}
            onDblClick={() => onShapeDblClick?.(shape.id)}
            onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
            onDragMove={(e) => onShapeDragMove?.(e, shape.id, e.target.x(), e.target.y())}
            onDragEnd={() => onShapeDragEnd?.(shape.id)}
          />
        );
      }

      case "frame":
        return (
          <Fragment key={shape.id}>
            <Rect
              key={shape.id}
              id={shape.id}
              {...commonProps}
              width={w}
              height={h}
              cornerRadius={6}
              dash={[6, 4]}
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
              fontFamily="Inter, Arial, sans-serif"
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
            x={shape.x + w / 2}
            y={shape.y + h / 2}
            radiusX={w / 2}
            radiusY={h / 2}
            rotation={commonProps.rotation}
            fill={commonProps.fill}
            stroke={commonProps.stroke}
            strokeWidth={commonProps.strokeWidth}
            dash={strokeDash}
            opacity={commonProps.opacity}
            draggable={draggable}
            onClick={(e) => onShapeClick?.(e, shape.id)}
            onDblClick={() => onShapeDblClick?.(shape.id)}
            onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
            onDragMove={(e) => {
              const centerNodeX = e.target.x();
              const centerNodeY = e.target.y();
              onShapeDragMove?.(e, shape.id, centerNodeX - w / 2, centerNodeY - h / 2);
            }}
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
            width={w}
            height={h}
            text={shape.text?.content ?? ""}
            fontSize={shape.text?.fontSize ?? 14}
            fontFamily={shape.text?.fontFamily ?? "Inter, Arial, sans-serif"}
            fontStyle={shape.text?.bold ? "bold" : "normal"}
            fill={shape.text?.color ?? "#1e293b"}
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

  // Overlay text label inside shape
  if (!isEditingThis && shape.type !== "text" && shape.text?.content) {
    const labelBounds = getShapeBounds(doc, shape);
    nodes.push(
      <Text
        key={`${shape.id}-label`}
        x={labelBounds.x + 8}
        y={labelBounds.y + 8}
        width={Math.max(20, labelBounds.width - 16)}
        height={Math.max(20, labelBounds.height - 16)}
        text={shape.text.content}
        fontSize={shape.text.fontSize ?? 13}
        fontFamily={shape.text.fontFamily ?? "Inter, Arial, sans-serif"}
        fill={shape.text.color ?? (shape.type === "sticky" ? "#713f12" : "#1e293b")}
        align={shape.text.align ?? "center"}
        verticalAlign="middle"
        fontStyle={shape.text.bold ? "bold" : "normal"}
        rotation={commonProps.rotation}
        listening={false}
      />
    );
  }

  // Selected outline
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
  const [drawDraft, setDrawDraft] = useState<DrawDraft | null>(null);
  const [snapGuides, setSnapGuides] = useState<{ v: number | null; h: number | null }>({ v: null, h: null });
  const [placeKind, setPlaceKind] = useState<ShapeKind | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 });
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);

  const [activeColor, setActiveColor] = useState<string>("5");
  const [activeStrokeWidth, setActiveStrokeWidth] = useState<number>(2);

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

  const dragStateRef = useRef<{
    shapeId: string;
    startX: number;
    startY: number;
    initialPositions: Map<string, { x: number; y: number }>;
    directIds: Set<string>;
  } | null>(null);
  const marqueeRef = useRef<MarqueeState | null>(null);
  const arrowDraftRef = useRef<ArrowDraft | null>(null);
  const drawDraftRef = useRef<DrawDraft | null>(null);
  const clipboardRef = useRef<CanvasShape[]>([]);

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
    if (readOnly || modeRef.current === "arrow" || modeRef.current === "draw") return;
    const shape = doc.shapes.find((s) => s.id === shapeId);
    if (!shape || shape.type === "arrow" || shape.type === "line" || shape.type === "path" || shape.locked) return;
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
          : kind === "sticky"
            ? { id, type: "sticky", x, y, width, height, fill: "#fef08a", text: { content: "", fontSize: 14 } }
            : { id, type: kind as any, x, y, width, height, fill: activeColor, stroke: "#334155", strokeWidth: 2 };

    const newDoc = { ...baseDoc, shapes: [...baseDoc.shapes, newShape] };
    setDoc(newDoc);
    commitChanges(newDoc);
    setSelectedIds(new Set([id]));
    setModeSynced("select");

    if (kind === "text" || kind === "sticky") {
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
        const fontSize = textBlock.fontSize ?? 14;
        const longest = Math.max(...lines.map((l) => l.length));
        const width = Math.max(50, Math.round(longest * fontSize * 0.6 * 1.15));
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

      // Copy (Ctrl+C / Cmd+C)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        clipboardRef.current = doc.shapes.filter((s) => selectedIds.has(s.id));
        return;
      }

      // Paste (Ctrl+V / Cmd+V)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        if (clipboardRef.current.length === 0) return;
        const newIds = new Set<string>();
        const pasted: CanvasShape[] = clipboardRef.current.map((s) => {
          const freshId = generateShapeId("copy");
          newIds.add(freshId);
          return {
            ...s,
            id: freshId,
            name: s.name ? `${s.name}-copy` : undefined,
            x: "x" in s ? s.x + 20 : 0,
            y: "y" in s ? s.y + 20 : 0,
          };
        });
        const newDoc = { ...doc, shapes: [...doc.shapes, ...pasted] };
        setDoc(newDoc);
        setSelectedIds(newIds);
        commitChanges(newDoc);
        return;
      }

      // Duplicate (Ctrl+D / Cmd+D)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const toDup = doc.shapes.filter((s) => selectedIds.has(s.id));
        const newIds = new Set<string>();
        const dupShapes: CanvasShape[] = toDup.map((s) => {
          const freshId = generateShapeId("dup");
          newIds.add(freshId);
          return {
            ...s,
            id: freshId,
            name: s.name ? `${s.name}-copy` : undefined,
            x: "x" in s ? s.x + 20 : 0,
            y: "y" in s ? s.y + 20 : 0,
          };
        });
        const newDoc = { ...doc, shapes: [...doc.shapes, ...dupShapes] };
        setDoc(newDoc);
        setSelectedIds(newIds);
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

  // Tool-mode shortcuts: v = select, p = pen, a = arrow, r/o/d/t/s/f = place, 0 = reset zoom
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
          drawDraftRef.current = null;
          setDrawDraft(null);
          setModeSynced("select");
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case "v":
          setModeSynced("select");
          break;
        case "p":
          setModeSynced("draw");
          break;
        case "a":
          setModeSynced("arrow");
          break;
        case "r":
          enterPlaceMode("rectangle");
          break;
        case "d":
          enterPlaceMode("diamond");
          break;
        case "o":
          enterPlaceMode("ellipse");
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
    if (readOnly || modeRef.current === "arrow" || modeRef.current === "draw") return;
    if (e.evt.shiftKey) {
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(shapeId)) newSet.delete(shapeId);
        else newSet.add(shapeId);
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

    if (modeRef.current === "place" && placeKindRef.current) {
      const pos = stagePointFromEvent(stageRef.current);
      if (pos) {
        insertShapeAt(placeKindRef.current, pos.x, pos.y);
      }
      return;
    }

    if (e.target === stageRef.current) {
      setSelectedIds(new Set());
    }
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (readOnly) return;

    if (spaceHeldRef.current || e.evt.button === 1) {
      panRef.current = {
        startX: e.evt.clientX,
        startY: e.evt.clientY,
        originX: viewportRef.current.x,
        originY: viewportRef.current.y,
      };
      return;
    }

    const pos = stagePointFromEvent(stageRef.current);
    if (!pos) return;

    // Freehand Pen drawing
    if (modeRef.current === "draw") {
      const draft: DrawDraft = {
        points: [[pos.x, pos.y]],
        stroke: resolveColor(activeColor) ?? activeColor,
        strokeWidth: activeStrokeWidth,
      };
      drawDraftRef.current = draft;
      setDrawDraft(draft);
      return;
    }

    if (modeRef.current === "arrow") {
      const clickedShapeId = getShapeIdAtPointer(docRef.current, stageRef.current);
      const draft: ArrowDraft = {
        startPoint: pos,
        startBinding: clickedShapeId,
        currentPoint: pos,
        hoverShapeId: null,
      };
      arrowDraftRef.current = draft;
      setArrowDraft(draft);
      return;
    }

    if (e.target === stageRef.current && modeRef.current === "select") {
      marqueeStartRef.current = pos;
      marqueeRef.current = { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y };
      setMarquee(marqueeRef.current);
      if (!e.evt.shiftKey) {
        setSelectedIds(new Set());
      }
    }
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (panRef.current) {
      const dx = e.evt.clientX - panRef.current.startX;
      const dy = e.evt.clientY - panRef.current.startY;
      setViewport({
        scale: viewportRef.current.scale,
        x: panRef.current.originX + dx,
        y: panRef.current.originY + dy,
      });
      return;
    }

    const pos = stagePointFromEvent(stageRef.current);
    if (!pos) return;

    // Freehand drawing live points
    if (modeRef.current === "draw" && drawDraftRef.current) {
      const updated: DrawDraft = {
        ...drawDraftRef.current,
        points: [...drawDraftRef.current.points, [pos.x, pos.y]],
      };
      drawDraftRef.current = updated;
      setDrawDraft(updated);
      return;
    }

    if (modeRef.current === "arrow" && arrowDraftRef.current) {
      const hoverShapeId = getShapeIdAtPointer(docRef.current, stageRef.current);
      const nextDraft: ArrowDraft = {
        ...arrowDraftRef.current,
        currentPoint: pos,
        hoverShapeId: hoverShapeId === arrowDraftRef.current.startBinding ? null : hoverShapeId,
      };
      arrowDraftRef.current = nextDraft;
      setArrowDraft(nextDraft);
      return;
    }

    if (marqueeRef.current && marqueeStartRef.current) {
      const next: MarqueeState = {
        x0: marqueeStartRef.current.x,
        y0: marqueeStartRef.current.y,
        x1: pos.x,
        y1: pos.y,
      };
      marqueeRef.current = next;
      setMarquee(next);
    }
  };

  const handleStageMouseUp = () => {
    if (panRef.current) {
      panRef.current = null;
      return;
    }

    // Freehand drawing commit
    if (modeRef.current === "draw" && drawDraftRef.current) {
      const draft = drawDraftRef.current;
      drawDraftRef.current = null;
      setDrawDraft(null);

      if (draft.points.length > 1) {
        const pathShape: PathShape = {
          id: generateShapeId("p"),
          type: "path",
          x: 0,
          y: 0,
          points: draft.points,
          stroke: draft.stroke,
          strokeWidth: draft.strokeWidth,
        };
        const newDoc = { ...docRef.current, shapes: [...docRef.current.shapes, pathShape] };
        setDoc(newDoc);
        commitChanges(newDoc);
      }
      return;
    }

    if (modeRef.current === "arrow" && arrowDraftRef.current) {
      const draft = arrowDraftRef.current;
      arrowDraftRef.current = null;
      setArrowDraft(null);

      const dx = draft.currentPoint.x - draft.startPoint.x;
      const dy = draft.currentPoint.y - draft.startPoint.y;
      if (Math.hypot(dx, dy) >= 10) {
        const id = generateShapeId("a");
        const newArrow: CanvasShape = {
          id,
          type: "arrow",
          x: 0,
          y: 0,
          start: draft.startBinding ? { shapeId: draft.startBinding, anchor: "auto" } : draft.startPoint,
          end: draft.hoverShapeId ? { shapeId: draft.hoverShapeId, anchor: "auto" } : draft.currentPoint,
          stroke: "#475569",
          strokeWidth: 2,
        };

        const newDoc = { ...docRef.current, shapes: [...docRef.current.shapes, newArrow] };
        setDoc(newDoc);
        commitChanges(newDoc);
        setSelectedIds(new Set([id]));
        setModeSynced("select");
      }
      return;
    }

    if (marqueeRef.current) {
      const m = marqueeRef.current;
      marqueeRef.current = null;
      marqueeStartRef.current = null;
      setMarquee(null);

      const xMin = Math.min(m.x0, m.x1);
      const xMax = Math.max(m.x0, m.x1);
      const yMin = Math.min(m.y0, m.y1);
      const yMax = Math.max(m.y0, m.y1);

      if (Math.abs(m.x1 - m.x0) > 4 || Math.abs(m.y1 - m.y0) > 4) {
        suppressNextClickRef.current = true;
        const inMarquee = docRef.current.shapes.filter((s) => {
          if (s.locked) return false;
          const b = getShapeBounds(docRef.current, s);
          return b.x < xMax && b.x + b.width > xMin && b.y < yMax && b.y + b.height > yMin;
        });
        setSelectedIds(new Set(inMarquee.map((s) => s.id)));
      }
    }
  };

  const handleShapeDragStart = (shapeId: string, x: number, y: number) => {
    let directIds: Set<string>;
    if (selectedIds.has(shapeId)) {
      directIds = new Set(selectedIds);
    } else {
      directIds = new Set([shapeId]);
      setSelectedIds(directIds);
    }

    const currentDoc = docRef.current;
    const initialPositions = new Map<string, { x: number; y: number }>();
    const allMovedIds = new Set(directIds);

    const frameIds = Array.from(directIds).filter((id) => currentDoc.shapes.some((s) => s.id === id && s.type === "frame"));
    for (const frameId of frameIds) {
      for (const s of currentDoc.shapes) {
        if (s.frameId === frameId) allMovedIds.add(s.id);
      }
    }

    for (const s of currentDoc.shapes) {
      if (allMovedIds.has(s.id) && s.type !== "arrow" && s.type !== "line") {
        initialPositions.set(s.id, { x: s.x, y: s.y });
      }
    }

    dragStateRef.current = { shapeId, startX: x, startY: y, initialPositions, directIds };

    const candidateShapes = currentDoc.shapes.filter((s) => !allMovedIds.has(s.id));
    const verticals: number[] = [];
    const horizontals: number[] = [];
    for (const s of candidateShapes) {
      const b = getShapeBounds(currentDoc, s);
      verticals.push(b.x, b.x + b.width / 2, b.x + b.width);
      horizontals.push(b.y, b.y + b.height / 2, b.y + b.height);
    }
    snapCandidatesRef.current = { verticals, horizontals };
  };

  const handleShapeDragMove = (
    e: Konva.KonvaEventObject<DragEvent>,
    shapeId: string,
    rawNewX: number,
    rawNewY: number
  ) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    const baseDoc = docRef.current;
    const draggedShape = baseDoc.shapes.find((s) => s.id === shapeId);
    if (!draggedShape || draggedShape.type === "arrow" || draggedShape.type === "line") return;

    const bounds = getShapeBounds(baseDoc, draggedShape);
    const candidateLefts = [rawNewX, rawNewX + bounds.width / 2, rawNewX + bounds.width];
    const candidateTops = [rawNewY, rawNewY + bounds.height / 2, rawNewY + bounds.height];

    let snappedX = rawNewX;
    let snapGuideV: number | null = null;
    for (let i = 0; i < candidateLefts.length; i++) {
      const c = candidateLefts[i];
      let bestDist = SNAP_THRESHOLD;
      let match: number | null = null;
      for (const target of snapCandidatesRef.current.verticals) {
        const dist = Math.abs(c - target);
        if (dist < bestDist) {
          bestDist = dist;
          match = target;
        }
      }
      if (match !== null) {
        const offset = i === 0 ? 0 : i === 1 ? bounds.width / 2 : bounds.width;
        snappedX = match - offset;
        snapGuideV = match;
        break;
      }
    }

    let snappedY = rawNewY;
    let snapGuideH: number | null = null;
    for (let i = 0; i < candidateTops.length; i++) {
      const c = candidateTops[i];
      let bestDist = SNAP_THRESHOLD;
      let match: number | null = null;
      for (const target of snapCandidatesRef.current.horizontals) {
        const dist = Math.abs(c - target);
        if (dist < bestDist) {
          bestDist = dist;
          match = target;
        }
      }
      if (match !== null) {
        const offset = i === 0 ? 0 : i === 1 ? bounds.height / 2 : bounds.height;
        snappedY = match - offset;
        snapGuideH = match;
        break;
      }
    }

    setSnapGuides({ v: snapGuideV, h: snapGuideH });

    const dx = Math.round(snappedX - dragState.startX);
    const dy = Math.round(snappedY - dragState.startY);

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

    let finalDoc = dragDocRef.current ?? docRef.current;

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

  // Transformer synchronization
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
      return !!shape && shape.type !== "arrow" && shape.type !== "line" && shape.type !== "path" && !shape.locked;
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
      if (!shape || shape.type === "arrow" || shape.type === "line" || shape.type === "path") continue;

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
      if (s.type === "arrow" || s.type === "line" || s.type === "path") return s;
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

  // Selection bounding box for Floating Quick-Style Bar
  const selectedShapes = doc.shapes.filter((s) => selectedIds.has(s.id));
  const primarySelected = selectedShapes[0];

  const updateSelectedProps = (updates: Partial<CanvasShape> | ((s: CanvasShape) => CanvasShape)) => {
    const newShapes: CanvasShape[] = doc.shapes.map((s) => {
      if (!selectedIds.has(s.id)) return s;
      if (typeof updates === "function") return updates(s);
      return { ...s, ...updates } as CanvasShape;
    });
    const newDoc: CanvasDocument = { ...doc, shapes: newShapes };
    setDoc(newDoc);
    commitChanges(newDoc);
  };

  const bringSelectionToFront = () => {
    const without = doc.shapes.filter((s) => !selectedIds.has(s.id));
    const selected = doc.shapes.filter((s) => selectedIds.has(s.id));
    const newDoc = { ...doc, shapes: [...without, ...selected] };
    setDoc(newDoc);
    commitChanges(newDoc);
  };

  const sendSelectionToBack = () => {
    const without = doc.shapes.filter((s) => !selectedIds.has(s.id));
    const selected = doc.shapes.filter((s) => selectedIds.has(s.id));
    const newDoc = { ...doc, shapes: [...selected, ...without] };
    setDoc(newDoc);
    commitChanges(newDoc);
  };

  const toggleRenderMode = () => {
    const nextMode = doc.renderMode === "sketchy" ? "clean" : "sketchy";
    const newDoc: CanvasDocument = { ...doc, renderMode: nextMode };
    setDoc(newDoc);
    commitChanges(newDoc);
  };

  const alignSelected = (alignment: "left" | "center" | "right" | "top" | "middle" | "bottom" | "distribute-h" | "distribute-v") => {
    if (selectedShapes.length < 2) return;
    const boundsList = selectedShapes.map((s) => ({ shape: s, bounds: getShapeBounds(doc, s) }));

    const minX = Math.min(...boundsList.map((b) => b.bounds.x));
    const maxX = Math.max(...boundsList.map((b) => b.bounds.x + b.bounds.width));
    const minY = Math.min(...boundsList.map((b) => b.bounds.y));
    const maxY = Math.max(...boundsList.map((b) => b.bounds.y + b.bounds.height));

    if (alignment === "distribute-h" || alignment === "distribute-v") {
      const isH = alignment === "distribute-h";
      const sorted = [...boundsList].sort((a, b) => (isH ? a.bounds.x - b.bounds.x : a.bounds.y - b.bounds.y));
      const totalSpan = isH ? maxX - minX : maxY - minY;
      const totalShapeDim = sorted.reduce((sum, item) => sum + (isH ? item.bounds.width : item.bounds.height), 0);
      const gap = sorted.length > 1 ? Math.max(10, (totalSpan - totalShapeDim) / (sorted.length - 1)) : 20;

      let cursor = isH ? minX : minY;
      const newPosMap = new Map<string, number>();
      for (const item of sorted) {
        newPosMap.set(item.shape.id, Math.round(cursor));
        cursor += (isH ? item.bounds.width : item.bounds.height) + gap;
      }

      const distributed = doc.shapes.map((s) => {
        if (!newPosMap.has(s.id)) return s;
        return isH ? ({ ...s, x: newPosMap.get(s.id)! } as CanvasShape) : ({ ...s, y: newPosMap.get(s.id)! } as CanvasShape);
      });

      const newDoc: CanvasDocument = { ...doc, shapes: distributed };
      setDoc(newDoc);
      commitChanges(newDoc);
      return;
    }

    const newDocShapes = doc.shapes.map((s) => {
      if (!selectedIds.has(s.id) || s.type === "arrow" || s.type === "line") return s;
      const b = getShapeBounds(doc, s);
      switch (alignment) {
        case "left":
          return { ...s, x: minX } as CanvasShape;
        case "center":
          return { ...s, x: Math.round((minX + maxX) / 2 - b.width / 2) } as CanvasShape;
        case "right":
          return { ...s, x: Math.round(maxX - b.width) } as CanvasShape;
        case "top":
          return { ...s, y: minY } as CanvasShape;
        case "middle":
          return { ...s, y: Math.round((minY + maxY) / 2 - b.height / 2) } as CanvasShape;
        case "bottom":
          return { ...s, y: Math.round(maxY - b.height) } as CanvasShape;
        default:
          return s;
      }
    });

    const newDoc: CanvasDocument = { ...doc, shapes: newDocShapes };
    setDoc(newDoc);
    commitChanges(newDoc);
  };

  const handleExportSvg = () => {
    const svgString = freeformToSvg(doc);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "canvas-diagram.svg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
  const stageContainerRect = stageRef.current?.container().getBoundingClientRect();
  const hoverShape = arrowDraft?.hoverShapeId ? doc.shapes.find((s) => s.id === arrowDraft.hoverShapeId) : null;
  const hoverBounds = hoverShape ? getShapeBounds(doc, hoverShape) : null;

  // Selected bounding box for floating toolbar
  let selBounds: { x: number; y: number; width: number; height: number } | null = null;
  if (selectedShapes.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of selectedShapes) {
      const b = getShapeBounds(doc, s);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }
    selBounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  const toolbarButton = (label: string, active: boolean, onClick: () => void, title?: string) => (
    <button
      key={label}
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
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
    <div className="w-full h-full relative overflow-hidden select-none bg-slate-50 dark:bg-slate-950">
      {/* ─── Top Main Toolbar ────────────────────────────────────────────── */}
      {!readOnly && (
        <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-1.5 shadow-md backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 max-w-[calc(100%-24px)]">
          {toolbarButton("Select (V)", mode === "select", () => setModeSynced("select"))}
          {toolbarButton("Pen (P)", mode === "draw", () => setModeSynced("draw"))}
          {toolbarButton("Arrow (A)", mode === "arrow", () => setModeSynced("arrow"))}

          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {toolbarButton("Rect", mode === "place" && placeKind === "rectangle", () => enterPlaceMode("rectangle"))}
          {toolbarButton("Diamond", mode === "place" && placeKind === "diamond", () => enterPlaceMode("diamond"))}
          {toolbarButton("Ellipse", mode === "place" && placeKind === "ellipse", () => enterPlaceMode("ellipse"))}
          {toolbarButton("Triangle", mode === "place" && placeKind === "triangle", () => enterPlaceMode("triangle"))}
          {toolbarButton("Database", mode === "place" && placeKind === "cylinder", () => enterPlaceMode("cylinder"))}
          {toolbarButton("Cloud", mode === "place" && placeKind === "cloud", () => enterPlaceMode("cloud"))}
          {toolbarButton("Hexagon", mode === "place" && placeKind === "hexagon", () => enterPlaceMode("hexagon"))}
          {toolbarButton("Star", mode === "place" && placeKind === "star", () => enterPlaceMode("star"))}
          {toolbarButton("Sticky", mode === "place" && placeKind === "sticky", () => enterPlaceMode("sticky"))}
          {toolbarButton("Text", mode === "place" && placeKind === "text", () => enterPlaceMode("text"))}
          {toolbarButton("Frame", mode === "place" && placeKind === "frame", () => enterPlaceMode("frame"))}

          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-0.5" />

          <button
            type="button"
            onClick={toggleRenderMode}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
              doc.renderMode === "sketchy"
                ? "bg-amber-500 text-white shadow-sm"
                : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
            }`}
            title="Toggle between Clean Vector and Hand-Drawn Sketchy rendering"
          >
            {doc.renderMode === "sketchy" ? "Sketchy Style" : "Clean Style"}
          </button>

          <button
            type="button"
            onClick={handleExportSvg}
            className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Download pure vector SVG"
          >
            Export SVG
          </button>
        </div>
      )}

      {/* ─── Floating Quick-Style & Format Bar ────────────────────────────── */}
      {!readOnly && selBounds && selectedShapes.length > 0 && !editingShapeId && (
        <div
          className="absolute z-30 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
          style={{
            left: Math.max(12, viewport.x + selBounds.x * viewport.scale),
            top: Math.max(56, viewport.y + (selBounds.y - 48) * viewport.scale),
          }}
        >
          {/* Fill Palette Swatches */}
          <div className="flex items-center gap-1">
            {["transparent", "#ffffff", "5", "4", "3", "1", "6"].map((c) => {
              const hex = resolveColor(c) ?? c;
              const isActive = primarySelected?.fill === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setActiveColor(c);
                    updateSelectedProps({ fill: c });
                  }}
                  className={`h-4 w-4 rounded-full border border-slate-300 transition-transform ${
                    isActive ? "scale-125 ring-2 ring-indigo-500" : "hover:scale-110"
                  }`}
                  style={{ background: hex === "transparent" ? "repeating-linear-gradient(45deg,#ccc,#ccc 2px,#fff 2px,#fff 4px)" : hex }}
                  title={`Fill ${c}`}
                />
              );
            })}
          </div>

          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Stroke Width Toggle */}
          <div className="flex items-center gap-0.5">
            {[1, 2, 4].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => {
                  setActiveStrokeWidth(w);
                  updateSelectedProps({ strokeWidth: w });
                }}
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  primarySelected?.strokeWidth === w
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300"
                }`}
              >
                {w}px
              </button>
            ))}
          </div>

          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Dash style */}
          <button
            type="button"
            onClick={() =>
              updateSelectedProps((s) => ({
                ...s,
                strokeDash: s.strokeDash === "dashed" ? "solid" : "dashed",
              }))
            }
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              primarySelected?.strokeDash === "dashed"
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300"
            }`}
            title="Toggle Dashed Line"
          >
            Dash
          </button>

          {/* Text Bold */}
          <button
            type="button"
            onClick={() =>
              updateSelectedProps((s) => ({
                ...s,
                text: { ...(s.text ?? { content: "" }), bold: !s.text?.bold },
              }))
            }
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              primarySelected?.text?.bold
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300"
            }`}
            title="Toggle Bold"
          >
            B
          </button>

          {/* Multi-Selection Alignment Tools */}
          {selectedShapes.length >= 2 && (
            <>
              <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-0.5" />
              <button
                type="button"
                onClick={() => alignSelected("left")}
                className="rounded px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100 dark:text-slate-300"
                title="Align Left"
              >
                ⫷ L
              </button>
              <button
                type="button"
                onClick={() => alignSelected("center")}
                className="rounded px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100 dark:text-slate-300"
                title="Align Center"
              >
                | C |
              </button>
              <button
                type="button"
                onClick={() => alignSelected("right")}
                className="rounded px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100 dark:text-slate-300"
                title="Align Right"
              >
                R ⫸
              </button>
              <button
                type="button"
                onClick={() => alignSelected("distribute-h")}
                className="rounded px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100 dark:text-slate-300"
                title="Distribute Horizontally"
              >
                ↔
              </button>
            </>
          )}

          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Layer Arrange */}
          <button
            type="button"
            onClick={bringSelectionToFront}
            className="rounded px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100 dark:text-slate-300"
            title="Bring to Front"
          >
            Front
          </button>
          <button
            type="button"
            onClick={sendSelectionToBack}
            className="rounded px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100 dark:text-slate-300"
            title="Send to Back"
          >
            Back
          </button>
        </div>
      )}

      {/* ─── Konva Canvas Stage ──────────────────────────────────────────── */}
      <Stage
        ref={stageRef}
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        x={viewport.x}
        y={viewport.y}
        style={{ cursor: isSpaceHeld ? "grab" : mode === "draw" ? "crosshair" : undefined }}
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

          {/* Freehand Live Stroke in Draw Mode */}
          {drawDraft && drawDraft.points.length > 1 && (
            <Path
              data={getSvgPathFromStroke(
                getStroke(drawDraft.points, {
                  size: drawDraft.strokeWidth * 3,
                  thinning: 0.5,
                  smoothing: 0.5,
                  streamline: 0.5,
                })
              )}
              fill={drawDraft.stroke}
              listening={false}
            />
          )}

          {/* Marquee Box */}
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

          {/* Alignment Snap Guides */}
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

          {/* Transformer */}
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

        {/* Live Arrow Draft Layer */}
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

      {/* ─── Inline Text Editing Overlay ─────────────────────────────────── */}
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
            fontSize: (editingShape.text?.fontSize ?? 14) * viewport.scale,
            fontFamily: editingShape.text?.fontFamily ?? "Inter, Arial, sans-serif",
            color: editingShape.text?.color ?? "#1e293b",
            textAlign: editingShape.text?.align ?? (editingShape.type === "text" ? "left" : "center"),
            fontWeight: editingShape.text?.bold ? "bold" : "normal",
            background: editingShape.type === "sticky" ? "#fef08a" : "rgba(255,255,255,0.95)",
            border: "2px solid #4f46e5",
            borderRadius: 4,
            outline: "none",
            resize: "none",
            padding: 4,
            margin: 0,
            boxSizing: "border-box",
            zIndex: 50,
          }}
        />
      )}
    </div>
  );
}
