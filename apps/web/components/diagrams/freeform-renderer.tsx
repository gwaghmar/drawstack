"use client";

import { Fragment, useEffect, useRef, useState, type ChangeEvent, type DragEvent as ReactDragEvent, type ReactNode } from "react";
import { Stage, Layer, Rect, Ellipse, Line, Arrow, Text, Transformer, Shape, Path, Group, Image as KonvaImage, Circle as KonvaCircle } from "react-konva";
import Konva from "konva";
import rough from "roughjs";
import { getStroke } from "perfect-freehand";
import {
  MousePointer2,
  Pencil,
  MoveUpRight,
  Square,
  Diamond,
  Circle,
  Triangle,
  Database,
  Cloud,
  Hexagon,
  Star,
  StickyNote,
  Type,
  Frame as FrameIcon,
  ImagePlus,
  Sparkles,
  Feather,
  PenLine,
  Play,
  SquareIcon,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignHorizontalDistributeCenter,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignVerticalDistributeCenter,
  BringToFront,
  SendToBack,
  Bold,
  Minus,
  Plus,
  ArrowLeft,
  ArrowRight,
  Spline,
  CornerDownRight,
  IdCard,
  Table2,
  ListOrdered,
  Monitor,
  Gauge,
  LayoutDashboard,
  BarChart3,
  GitBranch,
  TrendingUp,
  ListChecks,
  Box,
  CircleDot,
  LayoutGrid,
  Workflow,
  Shapes,
  Users,
  Grid3x3,
  Search,
  X,
  Layers,
  type LucideIcon,
} from "lucide-react";

// Maps the catalog's plain icon-name strings to their component, so the shape
// catalog (shared data, no JSX) stays framework-agnostic while this file is
// the one place that knows how to draw a lucide icon.
const CATALOG_ICONS: Record<string, LucideIcon> = {
  Square, Diamond, Circle, Triangle, Database, Cloud, Hexagon, Star,
  StickyNote, Type, Frame: FrameIcon, ImagePlus, IdCard, Table2, ListOrdered,
  Monitor, Gauge, LayoutDashboard, BarChart3, GitBranch, TrendingUp,
  ListChecks, Box, CircleDot, LayoutGrid, Workflow, Shapes, Users, Grid3x3,
};
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
  type ArrowEndpoint,
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
  type CardShape,
  type TableShape,
  type ImageShape,
} from "@/lib/diagrams/freeform-canvas";

import { freeformToSvg, getSvgIcon } from "@/lib/diagrams/freeform-svg";
import { SHAPE_CATEGORIES, catalogByCategory, type ShapeCatalogEntry } from "@/lib/diagrams/freeform-shape-catalog";
import { autoLayoutFreeformDocument } from "@/lib/diagrams/freeform-autolayout";
import { YjsCanvasStore, type PeerInfo } from "@/lib/diagrams/yjs-store";

type Props = {
  source: string;
  onChange?: (source: string) => void;
  // Remote Yjs edits land here when provided, so the host can apply them without
  // recording an undo step (undo should only ever unwind the local user's own edits).
  onRemoteChange?: (source: string) => void;
  readOnly?: boolean;
  roomId?: string;
  presenceIdentity?: { name: string; color: string };
};

// Publishing every pointermove would flood awareness broadcasts; peers only need
// position updates a few times a second to look live.
const CURSOR_BROADCAST_INTERVAL_MS = 50;

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
  startAnchor?: "top" | "right" | "bottom" | "left";
  currentPoint: { x: number; y: number };
  hoverShapeId: string | null;
};

// Dragging one endpoint of an EXISTING arrow to rebind it — distinct from
// ArrowDraft, which draws a brand new arrow. Arrows were previously
// delete-and-redraw only; there was no way to grab an end and move it.
type ArrowEditDraft = {
  arrowId: string;
  end: "start" | "end";
  point: { x: number; y: number };
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
const ZOOM_STEP = 1.2;

// Card copy stacks under the 42px header: subtitle, then metadata rows, then
// the body paragraph. Both renderers must agree on these offsets or the canvas
// and the SVG export disagree.
function cardMetaTop(card: CardShape): number {
  return (card.subtitle ? 78 : 60);
}

function cardBodyTop(card: CardShape): number {
  const metaRows = card.metadata?.length ?? 0;
  if (metaRows > 0) return cardMetaTop(card) + metaRows * 18 + 6;
  return card.subtitle ? 74 : 54;
}

// getSvgIcon returns bare SVG markup; wrapping it in a data URI is what lets the
// same icon registry the SVG export uses also paint onto the Konva canvas,
// instead of maintaining a second set of icons for the interactive path.
function CardIcon({ name, x, y }: { name: string; x: number; y: number }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const markup = getSvgIcon(name, 16, "#4A85F6");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">${markup}</svg>`;
    const image = new window.Image();
    image.onload = () => setImg(image);
    image.src = `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
  }, [name]);

  if (!img) return null;
  return <KonvaImage image={img} x={x} y={y} width={16} height={16} listening={false} />;
}

function stagePointFromEvent(stage: Konva.Stage | null): { x: number; y: number } | null {
  if (!stage) return null;
  return stage.getRelativePointerPosition();
}

// Midpoint measured along the drawn polyline, not the straight start→end chord.
// Orthogonal arrows bend away from that chord, which left labels floating in
// empty space beside the line they belong to.
function polylineMidpoint(points: number[]): { x: number; y: number } {
  if (points.length < 4) return { x: points[0] ?? 0, y: points[1] ?? 0 };

  const segments: { x0: number; y0: number; x1: number; y1: number; len: number }[] = [];
  let total = 0;
  for (let i = 0; i + 3 < points.length; i += 2) {
    const [x0, y0, x1, y1] = [points[i], points[i + 1], points[i + 2], points[i + 3]];
    const len = Math.hypot(x1 - x0, y1 - y0);
    segments.push({ x0, y0, x1, y1, len });
    total += len;
  }
  if (total === 0) return { x: points[0], y: points[1] };

  let walked = 0;
  for (const seg of segments) {
    if (walked + seg.len >= total / 2) {
      const t = seg.len === 0 ? 0 : (total / 2 - walked) / seg.len;
      return {
        x: Math.round(seg.x0 + (seg.x1 - seg.x0) * t),
        y: Math.round(seg.y0 + (seg.y1 - seg.y0) * t),
      };
    }
    walked += seg.len;
  }
  return { x: Math.round(segments[segments.length - 1].x1), y: Math.round(segments[segments.length - 1].y1) };
}

function polylineLength(points: number[]): number {
  let total = 0;
  for (let i = 0; i + 3 < points.length; i += 2) {
    total += Math.hypot(points[i + 2] - points[i], points[i + 3] - points[i + 1]);
  }
  return total;
}

function edgeAnchorPoints(bounds: { x: number; y: number; width: number; height: number }) {
  const { x, y, width, height } = bounds;
  return [
    { anchor: "top" as const, x: x + width / 2, y },
    { anchor: "right" as const, x: x + width, y: y + height / 2 },
    { anchor: "bottom" as const, x: x + width / 2, y: y + height },
    { anchor: "left" as const, x, y: y + height / 2 },
  ];
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

function getArrowIdAtPointer(doc: CanvasDocument, stage: Konva.Stage | null): string | null {
  if (!stage) return null;
  const pos = stage.getPointerPosition();
  if (!pos) return null;
  const node = stage.getIntersection(pos);
  const id = node?.id();
  if (!id) return null;
  const shape = doc.shapes.find((s) => s.id === id);
  if (!shape || (shape.type !== "arrow" && shape.type !== "line")) return null;
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

function computeOrthogonalSegment(
  start: { x: number; y: number },
  end: { x: number; y: number }
): number[] {
  const midX = Math.round((start.x + end.x) / 2);
  return [start.x, start.y, midX, start.y, midX, end.y, end.x, end.y];
}

// Applies the right-angle bend between every consecutive pair so multi-waypoint
// arrows stay orthogonal along their whole route, not just start->end.
function computeOrthogonalPoints(points: { x: number; y: number }[]): number[] {
  if (points.length < 2) return points.flatMap((p) => [p.x, p.y]);
  const out: number[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const seg = computeOrthogonalSegment(points[i], points[i + 1]);
    out.push(...(i === 0 ? seg : seg.slice(2)));
  }
  return out;
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

const MACRO_SHAPE_TYPES = new Set<CanvasShape["type"]>([
  "dashboard",
  "chart",
  "mindmap",
  "scurve_timeline",
  "step_timeline",
  "metric",
  "mockup",
  "isometric_block",
  "tech_hud_panel",
  "layered_process_map",
  "venn_timeline",
  "dot_matrix",
  "feed_table",
  "pictogram",
  "pictogram_row",
  "mesh_connector",
]);

// ─── Table cell editing (Konva-side only) ─────────────────────────────────
// The "table" shape is a DB-schema table (tableName + columns[{name,type}]),
// NOT a generic spreadsheet grid — there is no `cells` field. Cell geometry
// below is keyed to the constants the Konva `case "table"` branch renders
// with (header 32px, row pitch 20px) so hit-testing and the edit overlay
// line up with what's actually drawn. Note: freeform-svg.ts's table export
// renderer uses slightly different constants (header 34px, row pitch 22px,
// rows starting at 54 vs 42) — pre-existing drift between the two render
// paths, not introduced here. Left alone; flagged for a future unification.
type TableCellCoord =
  | { kind: "tableName" }
  | { kind: "column"; index: number; field: "name" | "type" };

const TABLE_CELL_HEADER_HEIGHT = 32;
const TABLE_CELL_ROW_HEIGHT = 20;

function tableCellKey(cell: TableCellCoord): string {
  return cell.kind === "tableName" ? "tableName" : `col-${cell.index}-${cell.field}`;
}

function computeTableCellRects(
  table: TableShape
): Array<{ coord: TableCellCoord; x: number; y: number; width: number; height: number }> {
  const w = table.width;
  const rects: Array<{ coord: TableCellCoord; x: number; y: number; width: number; height: number }> = [
    { coord: { kind: "tableName" }, x: 0, y: 0, width: w, height: TABLE_CELL_HEADER_HEIGHT },
  ];
  table.columns.forEach((_, index) => {
    const rowY = TABLE_CELL_HEADER_HEIGHT + index * TABLE_CELL_ROW_HEIGHT;
    rects.push({ coord: { kind: "column", index, field: "name" }, x: 0, y: rowY, width: w / 2, height: TABLE_CELL_ROW_HEIGHT });
    rects.push({ coord: { kind: "column", index, field: "type" }, x: w / 2, y: rowY, width: w / 2, height: TABLE_CELL_ROW_HEIGHT });
  });
  return rects;
}

function hitTestTableCell(table: TableShape, point: { x: number; y: number }): TableCellCoord | null {
  const rects = computeTableCellRects(table);
  const hit = rects.find(
    (r) => point.x >= r.x && point.x < r.x + r.width && point.y >= r.y && point.y < r.y + r.height
  );
  return hit ? hit.coord : null;
}

function nextTableCell(table: TableShape, cell: TableCellCoord, reverse: boolean): TableCellCoord | null {
  const seq = computeTableCellRects(table).map((r) => r.coord);
  const curIdx = seq.findIndex((c) => tableCellKey(c) === tableCellKey(cell));
  if (curIdx === -1) return null;
  const nextIdx = reverse ? curIdx - 1 : curIdx + 1;
  return nextIdx >= 0 && nextIdx < seq.length ? seq[nextIdx] : null;
}

function readTableCellValue(table: TableShape, cell: TableCellCoord): string {
  if (cell.kind === "tableName") return table.tableName;
  const col = table.columns[cell.index];
  if (!col) return "";
  return cell.field === "name" ? col.name : col.type;
}

function applyTableCellEdit(
  doc: CanvasDocument,
  shapeId: string,
  cell: TableCellCoord,
  content: string
): CanvasDocument {
  const newShapes = doc.shapes.map((s) => {
    if (s.id !== shapeId || s.type !== "table") return s;
    const t = s as TableShape;
    if (cell.kind === "tableName") {
      return { ...t, tableName: content.trim() === "" ? t.tableName : content };
    }
    const columns = t.columns.map((col, idx) => {
      if (idx !== cell.index) return col;
      const trimmed = content.trim() === "" ? (cell.field === "name" ? col.name : col.type) : content;
      return cell.field === "name" ? { ...col, name: trimmed } : { ...col, type: trimmed };
    });
    return { ...t, columns };
  });
  return { ...doc, shapes: newShapes };
}

type MacroShapeNodeProps = {
  shape: CanvasShape;
  renderMode: CanvasDocument["renderMode"];
  bounds: { x: number; y: number; width: number; height: number };
  draggable: boolean;
  rotation: number;
  opacity: number;
  onShapeClick?: (e: Konva.KonvaEventObject<MouseEvent>, shapeId: string) => void;
  onShapeDblClick?: (shapeId: string) => void;
  onShapeDragStart?: (shapeId: string, x: number, y: number) => void;
  onShapeDragMove?: (e: Konva.KonvaEventObject<DragEvent>, shapeId: string, x: number, y: number) => void;
  onShapeDragEnd?: (shapeId: string) => void;
};

/** Macro shapes are drawn by freeformToSvg and rasterized into Konva so canvas and export cannot drift. */
function MacroShapeNode({
  shape,
  renderMode,
  bounds,
  draggable,
  rotation,
  opacity,
  onShapeClick,
  onShapeDblClick,
  onShapeDragStart,
  onShapeDragMove,
  onShapeDragEnd,
}: MacroShapeNodeProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const signature = JSON.stringify(shape);

  useEffect(() => {
    let cancelled = false;
    let svg: string;
    try {
      svg = freeformToSvg({ version: 1, renderMode, shapes: [shape] }, { bare: true });
    } catch {
      // AI-emitted macro shapes can omit fields the renderer expects; keep the placeholder
      // rather than letting one bad shape throw the whole canvas render.
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signature is the serialized shape
  }, [signature, renderMode]);

  const handlers = {
    draggable,
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => onShapeClick?.(e, shape.id),
    onDblClick: () => onShapeDblClick?.(shape.id),
    onDragStart: () => onShapeDragStart?.(shape.id, shape.x, shape.y),
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) =>
      onShapeDragMove?.(e, shape.id, e.target.x(), e.target.y()),
    onDragEnd: () => onShapeDragEnd?.(shape.id),
  };

  if (!image) {
    return (
      <Rect
        id={shape.id}
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        cornerRadius={8}
        fill="#f1f5f9"
        stroke="#cbd5e1"
        strokeWidth={1}
        dash={[6, 6]}
        {...handlers}
      />
    );
  }

  return (
    <KonvaImage
      id={shape.id}
      image={image}
      x={bounds.x}
      y={bounds.y}
      width={bounds.width}
      height={bounds.height}
      rotation={rotation}
      opacity={opacity}
      {...handlers}
    />
  );
}

type ImageShapeNodeProps = {
  shape: ImageShape;
  w: number;
  h: number;
  commonProps: { rotation: number; opacity: number; stroke: string; strokeWidth: number };
  draggable: boolean;
  onShapeClick?: (e: Konva.KonvaEventObject<MouseEvent>, shapeId: string) => void;
  onShapeDblClick?: (shapeId: string) => void;
  onShapeDragStart?: (shapeId: string, x: number, y: number) => void;
  onShapeDragMove?: (e: Konva.KonvaEventObject<DragEvent>, shapeId: string, x: number, y: number) => void;
  onShapeDragEnd?: (shapeId: string) => void;
};

// `renderShape` below is a plain function, not a component, so it can't hold
// the async-loaded-image state itself — same reason MacroShapeNode exists as
// its own component. Without this, `case "image"` could only ever paint the
// static placeholder Rect, never the actual picture (SVG export already
// rendered images correctly via freeformToSvg — this was a real WYSIWYG gap
// on the interactive canvas, not just an unloaded-yet placeholder).
function ImageShapeNode({
  shape,
  w,
  h,
  commonProps,
  draggable,
  onShapeClick,
  onShapeDblClick,
  onShapeDragStart,
  onShapeDragMove,
  onShapeDragEnd,
}: ImageShapeNodeProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setImage(null);
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.src = shape.src;
    return () => {
      cancelled = true;
    };
  }, [shape.src]);

  const handlers = {
    draggable,
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => onShapeClick?.(e, shape.id),
    onDblClick: () => onShapeDblClick?.(shape.id),
    onDragStart: () => onShapeDragStart?.(shape.id, shape.x, shape.y),
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) =>
      onShapeDragMove?.(e, shape.id, e.target.x(), e.target.y()),
    onDragEnd: () => onShapeDragEnd?.(shape.id),
  };

  return (
    <Group
      key={shape.id}
      id={shape.id}
      x={shape.x}
      y={shape.y}
      rotation={commonProps.rotation}
      opacity={commonProps.opacity}
      {...handlers}
    >
      {image ? (
        <KonvaImage image={image} x={0} y={0} width={w} height={h} cornerRadius={shape.cornerRadius ?? 8} />
      ) : (
        <Rect x={0} y={0} width={w} height={h} cornerRadius={shape.cornerRadius ?? 8} fill="#e2e8f0" />
      )}
      <Rect
        x={0}
        y={0}
        width={w}
        height={h}
        cornerRadius={shape.cornerRadius ?? 8}
        stroke={commonProps.stroke}
        strokeWidth={commonProps.strokeWidth}
      />
    </Group>
  );
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
  mode: ToolMode = "select",
  onTableCellDblClick?: (shapeId: string, cell: TableCellCoord) => void
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
    const fullPoints = [startPoint, ...(arrowShape.waypoints ?? []), endPoint];

    let points: number[];
    let tension = 0;
    if (arrowShape.routing === "orthogonal") {
      points = computeOrthogonalPoints(fullPoints);
    } else {
      points = fullPoints.flatMap((p) => [p.x, p.y]);
      if (arrowShape.routing === "curved") tension = 0.4;
    }

    const { x: midX, y: midY } = polylineMidpoint(points);

    const junctionNodes = arrowShape.showJunctions
      ? fullPoints.map((p, i) => (
          <KonvaCircle
            key={`${shape.id}-junction-${i}`}
            x={p.x}
            y={p.y}
            radius={4}
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={1.5}
            listening={false}
          />
        ))
      : null;

    const arrowNode =
      shape.type === "arrow" ? (
        <Arrow
          key={shape.id}
          id={shape.id}
          points={points}
          tension={tension}
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
          onDblClick={() => onShapeDblClick?.(shape.id)}
        />
      ) : (
        <Line
          key={shape.id}
          id={shape.id}
          points={points}
          tension={tension}
          stroke={stroke}
          strokeWidth={commonProps.strokeWidth}
          dash={strokeDash}
          opacity={commonProps.opacity}
          listening={!readOnly}
          onClick={(e) => onShapeClick?.(e, shape.id)}
          onDblClick={() => onShapeDblClick?.(shape.id)}
        />
      );

    // Cap label width to the gap actually available along the path — an
    // unclamped label on a short segment (two shapes placed close together)
    // spilled past its own line and onto whichever shape was nearest.
    const labelNode = arrowShape.label ? (() => {
      const desiredWidth = Math.max(40, arrowShape.label.length * 8);
      const availableWidth = Math.max(30, polylineLength(points) - 16);
      const labelWidth = Math.min(desiredWidth, availableWidth);
      const halfWidth = labelWidth / 2;
      return (
        <Group key={`${shape.id}-label-group`} x={midX} y={midY - 14} listening={false}>
          <Rect
            x={-halfWidth}
            y={-2}
            width={labelWidth}
            height={20}
            fill="#ffffff"
            cornerRadius={4}
            stroke="#cbd5e1"
            strokeWidth={1}
            opacity={0.9}
          />
          <Text
            x={-halfWidth}
            y={2}
            width={labelWidth}
            text={arrowShape.label}
            fontSize={11}
            fontFamily="Inter, Arial, sans-serif"
            fill="#475569"
            align="center"
            wrap="none"
            ellipsis
          />
        </Group>
      );
    })() : null;

    return (
      <Fragment key={shape.id}>
        {arrowNode}
        {junctionNodes}
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

      case "card": {
        const card = shape as CardShape;
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
            <Rect
              x={0}
              y={0}
              width={w}
              height={h}
              cornerRadius={card.cornerRadius ?? 10}
              fill="#ffffff"
              stroke={commonProps.stroke}
              strokeWidth={commonProps.strokeWidth}
              shadowColor="#0f172a"
              shadowBlur={10}
              shadowOpacity={0.08}
              shadowOffsetY={4}
            />
            {/* Header bar — 42px to match the SVG export layout */}
            <Rect
              x={0}
              y={0}
              width={w}
              height={42}
              cornerRadius={[card.cornerRadius ?? 10, card.cornerRadius ?? 10, 0, 0]}
              fill={commonProps.fill === "transparent" ? "#f8fafc" : commonProps.fill}
            />
            <Line points={[0, 42, w, 42]} stroke="#e2e8f0" strokeWidth={1} />
            <Rect x={10} y={9} width={24} height={24} cornerRadius={6} fill="#ffffff" stroke="#e2e8f0" strokeWidth={1} />
            <CardIcon name={card.icon ?? card.role ?? card.title} x={14} y={13} />
            <Text
              x={40}
              y={14}
              width={Math.max(20, w - 52 - (card.badge?.text ? card.badge.text.length * 6 + 16 : 0))}
              text={card.title}
              fontSize={13}
              fontStyle="bold"
              fontFamily="Inter, Arial, sans-serif"
              fill="#0f172a"
              ellipsis
              wrap="none"
              listening={false}
            />
            {card.badge?.text && (
              <>
                <Rect
                  x={w - 12 - (card.badge.text.length * 6 + 12)}
                  y={12}
                  width={card.badge.text.length * 6 + 12}
                  height={18}
                  cornerRadius={4}
                  fill={card.badge.bg ?? "#eff6ff"}
                />
                <Text
                  x={w - 12 - (card.badge.text.length * 6 + 12)}
                  y={17}
                  width={card.badge.text.length * 6 + 12}
                  text={card.badge.text}
                  fontSize={9.5}
                  fontStyle="bold"
                  align="center"
                  fontFamily="Inter, Arial, sans-serif"
                  fill={card.badge.color ?? "#1d4ed8"}
                  listening={false}
                />
              </>
            )}
            {card.subtitle && (
              <Text
                x={12}
                y={52}
                width={Math.max(20, w - 24)}
                text={card.subtitle}
                fontSize={11}
                fontFamily="Inter, Arial, sans-serif"
                fill="#64748b"
                wrap="word"
                listening={false}
              />
            )}
            {(card.metadata ?? []).map((m, idx) => (
              <Fragment key={`${shape.id}-meta-${idx}`}>
                <Ellipse x={15} y={cardMetaTop(card) + idx * 18} radiusX={2} radiusY={2} fill="#94a3b8" />
                <Text
                  x={22}
                  y={cardMetaTop(card) + idx * 18 - 5}
                  width={Math.max(20, w - 34)}
                  text={`${m.label}: ${m.value}`}
                  fontSize={10.5}
                  fontFamily="Inter, Arial, sans-serif"
                  fill="#475569"
                  ellipsis
                  wrap="none"
                  listening={false}
                />
              </Fragment>
            ))}
            {shape.text?.content && (
              <Text
                x={12}
                y={cardBodyTop(card)}
                width={Math.max(20, w - 24)}
                height={Math.max(12, h - cardBodyTop(card) - 10)}
                text={shape.text.content}
                fontSize={shape.text.fontSize ?? 11.5}
                fontFamily={shape.text.fontFamily ?? "Inter, Arial, sans-serif"}
                fill={shape.text.color ?? "#475569"}
                lineHeight={1.35}
                wrap="word"
                ellipsis
                listening={false}
              />
            )}
          </Group>
        );
      }

      case "table": {
        const table = shape as TableShape;
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
            onDblClick={(e) => {
              const pt = e.currentTarget.getRelativePointerPosition();
              const cell = pt ? hitTestTableCell(table, pt) : null;
              // A miss (e.g. dead space below the last row, when `height`
              // exceeds header + rows) must still route into table-cell
              // editing — falling through to the generic onShapeDblClick
              // would edit `text.content`, a field the table branch never
              // renders, silently swallowing the edit.
              onTableCellDblClick?.(shape.id, cell ?? { kind: "tableName" });
            }}
            onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
            onDragMove={(e) => onShapeDragMove?.(e, shape.id, e.target.x(), e.target.y())}
            onDragEnd={() => onShapeDragEnd?.(shape.id)}
          >
            <Rect
              x={0}
              y={0}
              width={w}
              height={h}
              cornerRadius={table.cornerRadius ?? 8}
              fill="#ffffff"
              stroke={commonProps.stroke}
              strokeWidth={commonProps.strokeWidth}
              shadowColor="#0f172a"
              shadowBlur={8}
              shadowOpacity={0.06}
              shadowOffsetY={3}
            />
            <Rect
              x={0}
              y={0}
              width={w}
              height={32}
              cornerRadius={[table.cornerRadius ?? 8, table.cornerRadius ?? 8, 0, 0]}
              fill={table.headerBg ? resolveColor(table.headerBg) ?? table.headerBg : "#f1f5f9"}
            />
            <Line points={[0, 32, w, 32]} stroke="#cbd5e1" strokeWidth={1} />
            <Text
              x={12}
              y={10}
              text={table.tableName}
              fontSize={12}
              fontStyle="bold"
              fontFamily="'JetBrains Mono', monospace"
              fill="#0f172a"
              listening={false}
            />
            {table.columns.map((col, idx) => (
              <Fragment key={`${col.name}-${idx}`}>
                <Text
                  x={12}
                  y={42 + idx * 20}
                  text={`${col.isPk ? "PK " : col.isFk ? "FK " : "• "}${col.name}`}
                  fontSize={11}
                  fontFamily="'JetBrains Mono', monospace"
                  fill={col.isPk ? "#b45309" : col.isFk ? "#0369a1" : "#1e293b"}
                  listening={false}
                />
                <Text
                  x={w - 12}
                  y={42 + idx * 20}
                  text={col.type}
                  align="right"
                  fontSize={10.5}
                  fontFamily="'JetBrains Mono', monospace"
                  fill="#64748b"
                  listening={false}
                />
              </Fragment>
            ))}
          </Group>
        );
      }

      case "image": {
        return (
          <ImageShapeNode
            key={shape.id}
            shape={shape as ImageShape}
            w={w}
            h={h}
            commonProps={commonProps}
            draggable={draggable}
            onShapeClick={onShapeClick}
            onShapeDblClick={onShapeDblClick}
            onShapeDragStart={onShapeDragStart}
            onShapeDragMove={onShapeDragMove}
            onShapeDragEnd={onShapeDragEnd}
          />
        );
      }

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
            wrap={shape.text?.wrap === false ? "none" : "word"}
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
        if (MACRO_SHAPE_TYPES.has(shape.type)) {
          const macroBounds = getShapeBounds(doc, shape);
          return (
            <MacroShapeNode
              key={shape.id}
              shape={shape}
              renderMode={doc.renderMode}
              bounds={macroBounds}
              draggable={draggable}
              rotation={commonProps.rotation}
              opacity={commonProps.opacity}
              onShapeClick={onShapeClick}
              onShapeDblClick={onShapeDblClick}
              onShapeDragStart={onShapeDragStart}
              onShapeDragMove={onShapeDragMove}
              onShapeDragEnd={onShapeDragEnd}
            />
          );
        }
        return null;
    }
  })();

  if (!shapeNode) return null;

  const nodes: React.ReactNode[] = [shapeNode];

  // Overlay text label inside shape. Card, table and frame lay out their own
  // copy (title, subtitle, body, rows, frame name) at fixed offsets — adding the
  // centered overlay on top of that printed two blocks of text over each other.
  // For a frame it was worse than duplication: the overlay centers on the whole
  // container, dropping its label across whatever the frame encloses.
  const laysOutOwnText = shape.type === "card" || shape.type === "table" || shape.type === "frame";
  if (!isEditingThis && shape.type !== "text" && !laysOutOwnText && shape.text?.content) {
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
        wrap={shape.text.wrap === false ? "none" : "word"}
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

export function FreeformRenderer({ source, onChange, onRemoteChange, readOnly, roomId, presenceIdentity }: Props) {
  const [doc, setDoc] = useState<CanvasDocument>(() => {
    const { doc: parsed, errors } = parseFreeformSource(source);
    if (errors.length > 0) return parsed;
    return parsed.shapes.length > 0 ? parsed : FIXTURE_DOCUMENT;
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingTableCell, setEditingTableCell] = useState<TableCellCoord | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<ToolMode>("select");
  const [arrowDraft, setArrowDraft] = useState<ArrowDraft | null>(null);
  const [drawDraft, setDrawDraft] = useState<DrawDraft | null>(null);
  const [snapGuides, setSnapGuides] = useState<{ v: number | null; h: number | null }>({ v: null, h: null });
  const [placeKind, setPlaceKind] = useState<ShapeKind | null>(null);
  const [shapePickerOpen, setShapePickerOpen] = useState(false);
  const [shapePickerQuery, setShapePickerQuery] = useState("");
  // Shape currently under the pointer in select mode, for draw.io-style hover
  // connection dots — lets a user start an arrow straight from a shape's edge
  // without switching to the Arrow tool first.
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  // Same idea, for arrows/lines — hovering one shows two grab dots at its
  // endpoints so an existing connection can be rebound without deleting and
  // redrawing it.
  const [hoveredArrowId, setHoveredArrowId] = useState<string | null>(null);
  const [arrowEditDraft, setArrowEditDraft] = useState<ArrowEditDraft | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 });
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  // Present Mode frame-stepping position — ephemeral UI/viewport state only,
  // deliberately NOT part of `doc` (never runs through commitChanges). Doc
  // changes go through undo history and sync to Yjs collaborators; stepping
  // through slides during a presentation must do neither.
  const [presentFrameIndex, setPresentFrameIndex] = useState(0);

  const [activeColor, setActiveColor] = useState<string>("5");
  const [activeStrokeWidth, setActiveStrokeWidth] = useState<number>(2);

  const isApplyingRef = useRef(false);
  const lastSourceRef = useRef(source);
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  const yjsStoreRef = useRef<YjsCanvasStore | null>(null);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const lastCursorBroadcastRef = useRef(0);
  const snapCandidatesRef = useRef<SnapCandidates>({ verticals: [], horizontals: [] });
  const modeRef = useRef<ToolMode>(mode);
  const placeKindRef = useRef<ShapeKind | null>(null);
  const dragDocRef = useRef<CanvasDocument | null>(null);
  const suppressNextClickRef = useRef(false);
  const spaceHeldRef = useRef(false);
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onRemoteChangeRef = useRef(onRemoteChange);
  onRemoteChangeRef.current = onRemoteChange;

  const dragStateRef = useRef<{
    shapeId: string;
    startX: number;
    startY: number;
    initialPositions: Map<string, { x: number; y: number }>;
    directIds: Set<string>;
  } | null>(null);
  const marqueeRef = useRef<MarqueeState | null>(null);
  const arrowDraftRef = useRef<ArrowDraft | null>(null);
  const arrowEditDraftRef = useRef<ArrowEditDraft | null>(null);
  const dotDragActiveRef = useRef(false);
  const drawDraftRef = useRef<DrawDraft | null>(null);
  const clipboardRef = useRef<CanvasShape[]>([]);
  const opacityCommitRef = useRef<CanvasDocument | null>(null);

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

  // Starts an arrow drag from a hover-dot press — same draft state the Arrow
  // tool itself produces, so the rest of the drag (live preview, snapping to
  // a target shape, finalizing on mouse-up) is the exact same code path with
  // no duplication.
  const startConnectionDrag = (shapeId: string, anchor: "top" | "right" | "bottom" | "left", point: { x: number; y: number }) => {
    dotDragActiveRef.current = true;
    setModeSynced("arrow");
    const draft: ArrowDraft = {
      startPoint: point,
      startBinding: shapeId,
      startAnchor: anchor,
      currentPoint: point,
      hoverShapeId: null,
    };
    arrowDraftRef.current = draft;
    setArrowDraft(draft);
  };

  // Starts a rebind drag from one endpoint of an already-existing arrow.
  // Deliberately NOT routed through modeRef/setModeSynced like
  // startConnectionDrag — this is a self-contained gesture, checked directly
  // via arrowEditDraftRef in the stage move/up handlers, so it can't be
  // confused with (or clobber) whatever tool the user currently has active.
  const startArrowEndpointDrag = (arrowId: string, end: "start" | "end", point: { x: number; y: number }) => {
    const draft: ArrowEditDraft = { arrowId, end, point, hoverShapeId: null };
    arrowEditDraftRef.current = draft;
    setArrowEditDraft(draft);
  };

  // Setup Yjs multiplayer collaboration if roomId is provided
  useEffect(() => {
    if (!roomId) return;
    const store = new YjsCanvasStore(roomId, docRef.current, presenceIdentity);
    yjsStoreRef.current = store;

    const unsubscribe = store.subscribe((remoteShapes) => {
      setDoc((prev) => {
        const nextDoc = { ...prev, shapes: remoteShapes };
        // Remote edits go through onRemoteChange (no recordUndo) when the host
        // provides it; local gesture commits keep going through onChange below.
        // Read via refs, not the closed-over props, so this effect's own
        // dependency array stays fixed at [roomId, readOnly] regardless of
        // callback identity churn on the caller's side.
        const notify = onRemoteChangeRef.current ?? onChangeRef.current;
        if (!readOnly && notify) {
          const serialized = serializeFreeformDocument(nextDoc);
          if (serialized !== lastSourceRef.current) {
            lastSourceRef.current = serialized;
            notify(serialized);
          }
        }
        return nextDoc;
      });
    });

    const unsubscribePeers = store.onPeersChange(setPeers);

    return () => {
      unsubscribe();
      unsubscribePeers();
      store.destroy();
      yjsStoreRef.current = null;
      setPeers([]);
    };
  }, [roomId, readOnly]);

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

  // Commit changes to onChange and Yjs store
  const commitChanges = (newDoc: CanvasDocument) => {
    if (readOnly) return;
    if (yjsStoreRef.current) {
      yjsStoreRef.current.syncLocalToYjs(newDoc.shapes);
    }
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
  }, [editingShapeId, editingTableCell]);

  const startEditing = (shapeId: string) => {
    if (readOnly || modeRef.current === "arrow" || modeRef.current === "draw") return;
    const shape = doc.shapes.find((s) => s.id === shapeId);
    if (!shape || shape.type === "line" || shape.type === "path" || shape.locked) return;
    setSelectedIds(new Set());
    setEditingShapeId(shapeId);
    setEditingTableCell(null);
    setEditingValue(
      shape.type === "frame"
        ? shape.name ?? ""
        : shape.type === "arrow"
          ? (shape as ArrowShape).label ?? ""
          : shape.text?.content ?? ""
    );
  };

  // Double-clicking a cell inside a table shape enters edit mode scoped to
  // just that cell (tableName header, or a column's name/type) rather than
  // the whole shape's (unused, for tables) `text` block.
  const startEditingTableCell = (shapeId: string, cell: TableCellCoord) => {
    if (readOnly || modeRef.current === "arrow" || modeRef.current === "draw") return;
    const shape = doc.shapes.find((s) => s.id === shapeId);
    if (!shape || shape.type !== "table" || shape.locked) return;
    setSelectedIds(new Set());
    setEditingShapeId(shapeId);
    setEditingTableCell(cell);
    setEditingValue(readTableCellValue(shape as TableShape, cell));
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

  const insertImageAt = (src: string, naturalWidth: number, naturalHeight: number, cx: number, cy: number) => {
    const MAX_DIM = 420;
    const scale = Math.min(1, MAX_DIM / Math.max(naturalWidth, naturalHeight));
    const width = Math.round(naturalWidth * scale);
    const height = Math.round(naturalHeight * scale);
    const x = Math.round(cx - width / 2);
    const y = Math.round(cy - height / 2);
    const baseDoc = docRef.current;
    const id = generateShapeId("img");

    const newShape: ImageShape = { id, type: "image", x, y, width, height, src, objectFit: "cover" };
    const newDoc = { ...baseDoc, shapes: [...baseDoc.shapes, newShape] };
    setDoc(newDoc);
    commitChanges(newDoc);
    setSelectedIds(new Set([id]));
    setModeSynced("select");
  };

  // Places any of the 29 catalog shapes — including the 18 that had no toolbar
  // button at all (card, dashboard, chart, mindmap, timelines, …) and were
  // previously reachable only by asking the AI to emit one.
  const insertCatalogShapeAt = (entry: ShapeCatalogEntry, cx: number, cy: number) => {
    const shape = entry.build(cx, cy);
    const baseDoc = docRef.current;
    const newDoc = { ...baseDoc, shapes: [...baseDoc.shapes, shape] };
    setDoc(newDoc);
    commitChanges(newDoc);
    setSelectedIds(new Set([shape.id]));
    setModeSynced("select");
    setShapePickerOpen(false);
  };

  const insertCatalogShapeAtCenter = (entry: ShapeCatalogEntry) => {
    const cx = (STAGE_WIDTH / 2 - viewportRef.current.x) / viewportRef.current.scale;
    const cy = (STAGE_HEIGHT / 2 - viewportRef.current.y) / viewportRef.current.scale;
    insertCatalogShapeAt(entry, cx, cy);
  };

  // Undo-stack entries and Yjs sync both serialize the full doc, so an
  // uncapped multi-MB paste/drop bloats both — downscale before it ever
  // becomes a stored data URL, not just the on-canvas display box.
  const MAX_STORED_IMAGE_DIM = 1600;

  const downscaleImageDataUrl = (img: HTMLImageElement, src: string): { src: string; width: number; height: number } => {
    const w = img.naturalWidth || 0;
    const h = img.naturalHeight || 0;
    const maxDim = Math.max(w, h);
    if (maxDim === 0 || maxDim <= MAX_STORED_IMAGE_DIM) {
      return { src, width: w || 300, height: h || 200 };
    }
    const scale = MAX_STORED_IMAGE_DIM / maxDim;
    const targetW = Math.round(w * scale);
    const targetH = Math.round(h * scale);
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { src, width: w, height: h };
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return { src: canvas.toDataURL("image/png"), width: targetW, height: targetH };
  };

  // Shared by the file-picker button, clipboard paste, and drag-drop — reads a
  // File into a data URL, downscales it if it's oversized, then places it via
  // the same sizing/placement logic (insertImageAt) all three paths need.
  const insertImageFromFile = (file: File, cx: number, cy: number) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rawSrc = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        const { src, width, height } = downscaleImageDataUrl(img, rawSrc);
        insertImageAt(src, width, height, cx, cy);
      };
      img.src = rawSrc;
    };
    reader.readAsDataURL(file);
  };

  const handleImageFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const cx = (STAGE_WIDTH / 2 - viewportRef.current.x) / viewportRef.current.scale;
    const cy = (STAGE_HEIGHT / 2 - viewportRef.current.y) / viewportRef.current.scale;
    insertImageFromFile(file, cx, cy);
  };

  const zoomBy = (factor: number) => {
    setViewport((prev) => {
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));
      const cx = STAGE_WIDTH / 2;
      const cy = STAGE_HEIGHT / 2;
      const docX = (cx - prev.x) / prev.scale;
      const docY = (cy - prev.y) / prev.scale;
      return { scale: newScale, x: cx - docX * newScale, y: cy - docY * newScale };
    });
  };

  const resetZoom = () => setViewport({ scale: 1, x: 0, y: 0 });

  // Fits the given shapes (or every shape when omitted/empty) into the
  // viewport with padding — same bounds-union + scale-to-fit math the
  // present-mode frame-navigate jump already does for a single frame.
  const zoomToFit = (shapes: CanvasShape[]) => {
    const baseDoc = docRef.current;
    const targets = shapes.length > 0 ? shapes : baseDoc.shapes;
    if (targets.length === 0) {
      resetZoom();
      return;
    }

    const boundsList = targets.map((s) => getShapeBounds(baseDoc, s));
    const minX = Math.min(...boundsList.map((b) => b.x));
    const minY = Math.min(...boundsList.map((b) => b.y));
    const maxX = Math.max(...boundsList.map((b) => b.x + b.width));
    const maxY = Math.max(...boundsList.map((b) => b.y + b.height));
    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);

    const PADDING = 48;
    const scaleX = (STAGE_WIDTH - PADDING * 2) / contentWidth;
    const scaleY = (STAGE_HEIGHT - PADDING * 2) / contentHeight;
    const finalScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(scaleX, scaleY)));

    const cx = minX + contentWidth / 2;
    const cy = minY + contentHeight / 2;
    setViewport({
      scale: finalScale,
      x: STAGE_WIDTH / 2 - cx * finalScale,
      y: STAGE_HEIGHT / 2 - cy * finalScale,
    });
  };

  // Shared by the Present Mode hotspot click (handleShapeClick) and the
  // Present Mode next/prev stepping below — one frame-fit computation, two
  // callers, so they never drift out of sync.
  const navigateViewportToFrame = (frame: FrameShape) => {
    const scaleX = (STAGE_WIDTH - 80) / frame.width;
    const scaleY = (STAGE_HEIGHT - 80) / frame.height;
    const scale = Math.min(scaleX, scaleY);
    const finalScale = Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE);
    const x = STAGE_WIDTH / 2 - (frame.x + frame.width / 2) * finalScale;
    const y = STAGE_HEIGHT / 2 - (frame.y + frame.height / 2) * finalScale;
    setViewport({ scale: finalScale, x, y });
  };

  const getPresentationFrames = (): FrameShape[] =>
    docRef.current.shapes.filter((s): s is FrameShape => s.type === "frame");

  // Clamps at the ends (no wraparound) — less surprising mid-presentation
  // than looping back to slide one. `presentFrameIndex` is local component
  // state only; it never touches `doc`/commitChanges (see its declaration).
  const stepPresentation = (delta: number) => {
    const frames = getPresentationFrames();
    if (frames.length === 0) return;
    setPresentFrameIndex((prev) => {
      const next = Math.min(Math.max(prev + delta, 0), frames.length - 1);
      navigateViewportToFrame(frames[next]);
      return next;
    });
  };

  const goToPresentationFrame = (index: number) => {
    const frames = getPresentationFrames();
    if (frames.length === 0) return;
    const clamped = Math.min(Math.max(index, 0), frames.length - 1);
    navigateViewportToFrame(frames[clamped]);
    setPresentFrameIndex(clamped);
  };

  const exitPresentationMode = () => {
    const newDoc = { ...docRef.current, presentationMode: false };
    setDoc(newDoc);
    commitChanges(newDoc);
    try {
      if (typeof document !== "undefined" && document.fullscreenElement) {
        document.exitFullscreen?.()?.catch(() => {});
      }
    } catch {
      // Same defensive posture as entering fullscreen — must never block
      // presentation mode from turning off.
    }
  };

  const enterPresentationMode = () => {
    const newDoc = { ...docRef.current, presentationMode: true };
    setDoc(newDoc);
    commitChanges(newDoc);
    setPresentFrameIndex(0);
    const frames = newDoc.shapes.filter((s): s is FrameShape => s.type === "frame");
    if (frames.length > 0) navigateViewportToFrame(frames[0]);
    try {
      containerRef.current?.requestFullscreen?.()?.catch(() => {});
    } catch {
      // Fullscreen API can reject/throw in embedded/iframe contexts with no
      // permission — presentation mode must still enter successfully.
    }
  };

  const commitEditing = (cancel: boolean) => {
    const shapeId = editingShapeId;
    if (!shapeId) return;
    const cell = editingTableCell;
    setEditingShapeId(null);
    setEditingTableCell(null);
    if (cancel) return;

    const shape = doc.shapes.find((s) => s.id === shapeId);
    if (!shape) return;
    const content = editingValue;

    if (shape.type === "table" && cell) {
      const newDoc = applyTableCellEdit(doc, shapeId, cell, content);
      setDoc(newDoc);
      commitChanges(newDoc);
      return;
    }

    if (shape.type === "frame") {
      const name = content.trim() === "" ? shape.name : content;
      const newShapes = doc.shapes.map((s) => (s.id === shapeId ? { ...s, name } : s));
      const newDoc = { ...doc, shapes: newShapes };
      setDoc(newDoc);
      commitChanges(newDoc);
      return;
    }

    if (shape.type === "arrow") {
      // Unlike a frame, an arrow with no label is a normal, common state —
      // clear it back out instead of keeping the old value on an empty commit.
      const newShapes = doc.shapes.map((s) => {
        if (s.id !== shapeId) return s;
        const updated = { ...(s as ArrowShape) };
        if (content === "") {
          delete updated.label;
        } else {
          updated.label = content;
        }
        return updated;
      });
      const newDoc = { ...doc, shapes: newShapes };
      setDoc(newDoc);
      commitChanges(newDoc);
      return;
    }

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
    if (readOnly || editingShapeId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Present Mode owns Left/Right/Space/Escape while active (see the
      // dedicated presentation-stepping effect below) — bail here so this
      // handler's 1px arrow-nudge never fires mid-presentation.
      if (doc.presentationMode) return;

      const activeElement = document.activeElement;
      if (activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA") {
        return;
      }

      // Shape clipboard paste moved to the `paste` DOM event listener below —
      // that's the same physical Cmd+V keystroke also fires a native `paste`
      // event, and when the OS clipboard holds an image we need that path to
      // win without also running this one and double-inserting.
      if (selectedIds.size === 0) return;

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

  // Clipboard paste (image takes priority over the internal shape clipboard —
  // both would otherwise fire off the same physical Cmd+V).
  useEffect(() => {
    if (readOnly) return;

    const handlePaste = (e: ClipboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      if (
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.isContentEditable
      ) {
        return;
      }

      const clipboardData = e.clipboardData;
      let imageFile: File | null = null;
      if (clipboardData) {
        if (clipboardData.files && clipboardData.files.length > 0) {
          imageFile = Array.from(clipboardData.files).find((f) => f.type.startsWith("image/")) ?? null;
        }
        if (!imageFile && clipboardData.items) {
          for (const item of Array.from(clipboardData.items)) {
            if (item.kind === "file" && item.type.startsWith("image/")) {
              imageFile = item.getAsFile();
              break;
            }
          }
        }
      }

      if (imageFile) {
        e.preventDefault();
        const cx = (STAGE_WIDTH / 2 - viewportRef.current.x) / viewportRef.current.scale;
        const cy = (STAGE_HEIGHT / 2 - viewportRef.current.y) / viewportRef.current.scale;
        insertImageFromFile(imageFile, cx, cy);
        return;
      }

      // No image — fall back to our own shape clipboard
      // (populated by Cmd+C above). Works with no live selection.
      if (clipboardRef.current.length === 0) return;
      e.preventDefault();
      const baseDoc = docRef.current;
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
      const newDoc = { ...baseDoc, shapes: [...baseDoc.shapes, ...pasted] };
      setDoc(newDoc);
      setSelectedIds(newIds);
      commitChanges(newDoc);
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [readOnly]);

  // Tool-mode shortcuts: v = select, p = pen, a = arrow, r/o/d/t/s/f = place, 0 = reset zoom
  useEffect(() => {
    if (readOnly) return;

    const handleModeKeyDown = (e: KeyboardEvent) => {
      if (editingShapeId) return;
      // ⌘0/⌃0 reset-zoom must fire before the modifier bail below (added for ⌘D —
      // see the file's other keydown handler) or the shortcut goes dead.
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        resetZoom();
        return;
      }
      // ⌘A/⌃A select-all — guarded separately from ⌘0 above (which fires even
      // while typing) so it never steals native text selection out of the AI
      // chat, Source panel, or title field.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        const el = document.activeElement as HTMLElement | null;
        if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable) return;
        e.preventDefault();
        const allIds = new Set(docRef.current.shapes.filter((s) => !s.locked).map((s) => s.id));
        setSelectedIds(allIds);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const activeElement = document.activeElement as HTMLElement | null;
      if (
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.isContentEditable
      ) {
        return;
      }

      // Present Mode owns every single-key shortcut while active — Escape
      // exits the presentation instead of resetting the draw/arrow tool, and
      // none of v/p/a/r/d/o/s/t/f/0 should switch tools mid-presentation.
      // Left/Right/Space stepping is handled by the dedicated effect below;
      // read via docRef (this effect doesn't depend on `doc`) so it stays
      // current without re-binding the listener on every doc edit.
      if (docRef.current.presentationMode) {
        if (e.key === "Escape") {
          e.preventDefault();
          exitPresentationMode();
        }
        return;
      }

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

      // Shift+2 zoom-to-selection — accept either the physical-key code
      // ("Digit2", stable across layouts where Shift+2 produces "@") or a
      // literal "2" in e.key, since some environments (synthetic/automated
      // key dispatch, certain layouts) don't populate e.code at all.
      if (e.shiftKey && (e.code === "Digit2" || e.key === "2")) {
        const selected = docRef.current.shapes.filter((s) => selectedIdsRef.current.has(s.id));
        if (selected.length > 0) {
          e.preventDefault();
          zoomToFit(selected);
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
      // Space steps to the next frame in Present Mode instead of arming pan.
      if (docRef.current.presentationMode) return;
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

  // Present Mode frame-stepping: Right Arrow / Space = next frame,
  // Left Arrow = previous, clamped at both ends (no wraparound — less
  // surprising mid-presentation than looping). Deliberately separate from
  // the tool-mode shortcut effect above so it works even when `readOnly`
  // (a shared/embedded canvas can still be presented, just not edited) —
  // matches handleShapeClick's presentation branch, which also runs ahead
  // of its own readOnly check.
  useEffect(() => {
    if (!doc.presentationMode) return;

    const handlePresentationKeyDown = (e: KeyboardEvent) => {
      if (editingShapeId) return;
      const activeElement = document.activeElement as HTMLElement | null;
      if (
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.isContentEditable
      ) {
        return;
      }

      if (e.key === "ArrowRight" || e.code === "Space" || e.key === " ") {
        e.preventDefault();
        stepPresentation(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepPresentation(-1);
      }
    };

    window.addEventListener("keydown", handlePresentationKeyDown);
    return () => window.removeEventListener("keydown", handlePresentationKeyDown);
  }, [doc.presentationMode, editingShapeId]);

  const handleShapeClick = (e: Konva.KonvaEventObject<MouseEvent>, shapeId: string) => {
    if (doc.presentationMode) {
      const shape = doc.shapes.find((s) => s.id === shapeId);
      if (shape?.onClickNavigateToFrameId) {
        const targetFrame = doc.shapes.find((s) => s.id === shape.onClickNavigateToFrameId && s.type === "frame");
        if (targetFrame && targetFrame.type === "frame") {
          navigateViewportToFrame(targetFrame);
          const frames = getPresentationFrames();
          const idx = frames.findIndex((f) => f.id === targetFrame.id);
          if (idx >= 0) setPresentFrameIndex(idx);
        }
      }
      return;
    }

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

    if (yjsStoreRef.current) {
      const now = Date.now();
      if (now - lastCursorBroadcastRef.current >= CURSOR_BROADCAST_INTERVAL_MS) {
        lastCursorBroadcastRef.current = now;
        yjsStoreRef.current.setLocalCursor(pos);
      }
    }

    // Arrow endpoint rebind in progress — checked independent of `mode` since
    // this gesture isn't a tool switch (see startArrowEndpointDrag).
    if (arrowEditDraftRef.current) {
      const targetShapeId = getShapeIdAtPointer(docRef.current, stageRef.current);
      const nextDraft: ArrowEditDraft = { ...arrowEditDraftRef.current, point: pos, hoverShapeId: targetShapeId };
      arrowEditDraftRef.current = nextDraft;
      setArrowEditDraft(nextDraft);
      return;
    }

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
      return;
    }

    // Hover connection dots: only worth computing when nothing else is
    // already in progress (a shape drag, a marquee, panning) — checked via
    // the same refs those flows already write to, per this file's rule that
    // gesture bookkeeping lives in refs, not state. A hit tests as either a
    // shape or an arrow, never both, so the arrow lookup only runs when the
    // shape one comes back empty.
    if (modeRef.current === "select" && !dragStateRef.current && !readOnly) {
      const id = getShapeIdAtPointer(docRef.current, stageRef.current);
      setHoveredShapeId((prev) => (prev === id ? prev : id));
      const arrowId = id ? null : getArrowIdAtPointer(docRef.current, stageRef.current);
      setHoveredArrowId((prev) => (prev === arrowId ? prev : arrowId));
    }
  };

  const handleStageMouseLeave = () => {
    lastCursorBroadcastRef.current = 0;
    yjsStoreRef.current?.setLocalCursor(null);
  };

  const handleStageMouseUp = () => {
    if (panRef.current) {
      panRef.current = null;
      return;
    }

    if (arrowEditDraftRef.current) {
      const draft = arrowEditDraftRef.current;
      arrowEditDraftRef.current = null;
      setArrowEditDraft(null);

      const newEndpoint: ArrowEndpoint = draft.hoverShapeId
        ? { shapeId: draft.hoverShapeId, anchor: "auto" }
        : draft.point;

      const newShapes = docRef.current.shapes.map((s) => {
        if (s.id !== draft.arrowId || (s.type !== "arrow" && s.type !== "line")) return s;
        const arrowShape = s as ArrowShape;
        return draft.end === "start"
          ? { ...arrowShape, start: newEndpoint }
          : { ...arrowShape, end: newEndpoint };
      });
      const newDoc = { ...docRef.current, shapes: newShapes };
      setDoc(newDoc);
      commitChanges(newDoc);
      setSelectedIds(new Set([draft.arrowId]));
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
          start: draft.startBinding ? { shapeId: draft.startBinding, anchor: draft.startAnchor ?? "auto" } : draft.startPoint,
          end: draft.hoverShapeId ? { shapeId: draft.hoverShapeId, anchor: "auto" } : draft.currentPoint,
          stroke: "#475569",
          strokeWidth: 2,
        };

        const newDoc = { ...docRef.current, shapes: [...docRef.current.shapes, newArrow] };
        setDoc(newDoc);
        commitChanges(newDoc);
        setSelectedIds(new Set([id]));
        setModeSynced("select");
      } else if (dotDragActiveRef.current) {
        // A drag that started from a hover dot always drops back into select
        // mode, even on a too-short/cancelled drag — the Arrow tool itself
        // stays active after a failed drag so the user can retry, but a
        // dot-started drag is a one-shot gesture, not a mode switch the user
        // explicitly asked for.
        setModeSynced("select");
      }
      dotDragActiveRef.current = false;
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

  // Opacity slider fires many onChange ticks per drag — commitChanges (and
  // therefore recordUndo, 50-step capped) must only run once, on release, or
  // one drag floods the whole undo stack. Live-preview via setDoc alone on
  // every tick; the final doc is stashed in a ref and committed on pointer-up.
  const updateSelectedOpacityLive = (value: number) => {
    const newShapes: CanvasShape[] = doc.shapes.map((s) =>
      selectedIds.has(s.id) ? ({ ...s, opacity: value } as CanvasShape) : s
    );
    const newDoc: CanvasDocument = { ...doc, shapes: newShapes };
    opacityCommitRef.current = newDoc;
    setDoc(newDoc);
  };

  const commitSelectedOpacity = () => {
    if (!opacityCommitRef.current) return;
    commitChanges(opacityCommitRef.current);
    opacityCommitRef.current = null;
  };

  const bumpSelectedFontSize = (delta: number) => {
    updateSelectedProps((s) => {
      const current = s.text?.fontSize ?? 14;
      const next = Math.max(8, Math.min(72, current + delta));
      return { ...s, text: { ...(s.text ?? { content: "" }), fontSize: next } };
    });
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

  const handleAutoLayout = (dir: "LR" | "TB" = "LR") => {
    const laidOut = autoLayoutFreeformDocument(doc, { direction: dir });
    setDoc(laidOut);
    commitChanges(laidOut);
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
  const editingTableCellRect =
    editingShape && editingShape.type === "table" && editingTableCell
      ? (() => {
          const table = editingShape as TableShape;
          const match = computeTableCellRects(table).find(
            (r) => tableCellKey(r.coord) === tableCellKey(editingTableCell)
          );
          return match
            ? { x: table.x + match.x, y: table.y + match.y, width: match.width, height: match.height }
            : null;
        })()
      : null;
  const editingRect = editingTableCellRect ?? (editingShape ? getShapeBounds(doc, editingShape) : null);
  const stageContainerRect = stageRef.current?.container().getBoundingClientRect();
  const presentationFrames = doc.presentationMode
    ? doc.shapes.filter((s): s is FrameShape => s.type === "frame")
    : [];
  // Rebind-target highlight is shared between drawing a brand new arrow
  // (arrowDraft) and dragging an existing one's endpoint (arrowEditDraft) —
  // same visual meaning either way: "release here to bind to this shape."
  const rebindTargetId = arrowDraft?.hoverShapeId ?? arrowEditDraft?.hoverShapeId;
  const hoverShape = rebindTargetId ? doc.shapes.find((s) => s.id === rebindTargetId) : null;
  const hoverBounds = hoverShape ? getShapeBounds(doc, hoverShape) : null;

  // Connection dots only make sense when idle in select mode — hidden the
  // instant a connection drag starts (arrowDraft takes over) or the shape is
  // locked, mid-edit, or already the drag target of something else.
  const connectDotsShape =
    !readOnly && mode === "select" && !arrowDraft && hoveredShapeId && hoveredShapeId !== editingShapeId
      ? doc.shapes.find((s) => s.id === hoveredShapeId && !s.locked)
      : null;
  const connectDotsBounds = connectDotsShape ? getShapeBounds(doc, connectDotsShape) : null;

  // Same gating for the hovered arrow's own endpoint-grab dots.
  const hoveredArrowShape =
    !readOnly && mode === "select" && !arrowDraft && !arrowEditDraft && hoveredArrowId
      ? (doc.shapes.find((s) => s.id === hoveredArrowId && !s.locked) as ArrowShape | undefined)
      : undefined;
  const hoveredArrowPoints = hoveredArrowShape ? resolveArrowRenderEndpoints(doc, hoveredArrowShape) : null;

  // While actively dragging an endpoint, the OTHER end stays fixed — read
  // straight from the live doc (not the drag point) so the preview line
  // anchors to the arrow's real, unmoved end.
  const arrowEditFixedPoint = (() => {
    if (!arrowEditDraft) return null;
    const shape = doc.shapes.find((s) => s.id === arrowEditDraft.arrowId) as ArrowShape | undefined;
    if (!shape) return null;
    const resolved = resolveArrowRenderEndpoints(doc, shape);
    return arrowEditDraft.end === "start" ? resolved.end : resolved.start;
  })();

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

  const toolbarButton = (
    icon: ReactNode,
    active: boolean,
    onClick: () => void,
    title: string,
  ) => (
    <button
      key={title}
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-all ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      {icon}
    </button>
  );

  const toolbarDivider = <div className="h-6 w-[1px] shrink-0 bg-slate-200 dark:bg-slate-700 mx-1" />;

  const styleDivider = <div className="h-4 w-[1px] shrink-0 bg-slate-900/10 dark:bg-white/10 mx-0.5" />;

  const styleIconButton = (icon: ReactNode, active: boolean, onClick: () => void, title: string) => (
    <button
      key={title}
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-indigo-600 text-white"
          : "text-slate-600 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10"
      }`}
    >
      {icon}
    </button>
  );

  const orderedShapes = [
    ...doc.shapes.filter((s) => s.type === "frame"),
    ...doc.shapes.filter((s) => s.type !== "frame"),
  ];

  const handleCanvasDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (readOnly) return;
    if (Array.from(e.dataTransfer.types).includes("Files")) {
      e.preventDefault();
      setIsDragOverCanvas(true);
    }
  };

  const handleCanvasDragLeave = (e: ReactDragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragOverCanvas(false);
  };

  const handleCanvasDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    if (readOnly) return;
    e.preventDefault();
    setIsDragOverCanvas(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    files.forEach((file, i) => {
      const dropX = stageContainerRect
        ? (e.clientX - stageContainerRect.left - viewport.x) / viewport.scale
        : (STAGE_WIDTH / 2 - viewport.x) / viewport.scale;
      const dropY = stageContainerRect
        ? (e.clientY - stageContainerRect.top - viewport.y) / viewport.scale
        : (STAGE_HEIGHT / 2 - viewport.y) / viewport.scale;
      insertImageFromFile(file, dropX + i * 24, dropY + i * 24);
    });
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden select-none bg-slate-50 dark:bg-slate-950"
      style={{
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        backgroundSize: `${20 * viewport.scale}px ${20 * viewport.scale}px`,
        backgroundImage: "radial-gradient(#cbd5e1 1.2px, transparent 1.2px)",
      }}
      onDragOver={handleCanvasDragOver}
      onDragLeave={handleCanvasDragLeave}
      onDrop={handleCanvasDrop}
    >
      {!readOnly && isDragOverCanvas && (
        <div className="pointer-events-none absolute inset-0 z-40 rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-500/5" />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />

      {/* ─── Top Main Toolbar ────────────────────────────────────────────── */}
      {!readOnly && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-wrap items-center justify-center gap-0.5 rounded-2xl border border-white/50 bg-white/50 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-900/50 max-w-[calc(100%-24px)]">
          {toolbarButton(<MousePointer2 className="h-4 w-4" />, mode === "select", () => setModeSynced("select"), "Select (V)")}
          {toolbarButton(<Pencil className="h-4 w-4" />, mode === "draw", () => setModeSynced("draw"), "Pen (P)")}
          {toolbarButton(<MoveUpRight className="h-4 w-4" />, mode === "arrow", () => setModeSynced("arrow"), "Arrow (A)")}

          {toolbarDivider}

          {toolbarButton(<Square className="h-4 w-4" />, mode === "place" && placeKind === "rectangle", () => enterPlaceMode("rectangle"), "Rectangle")}
          {toolbarButton(<Diamond className="h-4 w-4" />, mode === "place" && placeKind === "diamond", () => enterPlaceMode("diamond"), "Diamond")}
          {toolbarButton(<Circle className="h-4 w-4" />, mode === "place" && placeKind === "ellipse", () => enterPlaceMode("ellipse"), "Ellipse")}
          {toolbarButton(<Triangle className="h-4 w-4" />, mode === "place" && placeKind === "triangle", () => enterPlaceMode("triangle"), "Triangle")}
          {toolbarButton(<Database className="h-4 w-4" />, mode === "place" && placeKind === "cylinder", () => enterPlaceMode("cylinder"), "Database")}
          {toolbarButton(<Cloud className="h-4 w-4" />, mode === "place" && placeKind === "cloud", () => enterPlaceMode("cloud"), "Cloud")}
          {toolbarButton(<Hexagon className="h-4 w-4" />, mode === "place" && placeKind === "hexagon", () => enterPlaceMode("hexagon"), "Hexagon")}
          {toolbarButton(<Star className="h-4 w-4" />, mode === "place" && placeKind === "star", () => enterPlaceMode("star"), "Star")}
          {toolbarButton(<StickyNote className="h-4 w-4" />, mode === "place" && placeKind === "sticky", () => enterPlaceMode("sticky"), "Sticky note")}
          {toolbarButton(<Type className="h-4 w-4" />, mode === "place" && placeKind === "text", () => enterPlaceMode("text"), "Text")}
          {toolbarButton(<FrameIcon className="h-4 w-4" />, mode === "place" && placeKind === "frame", () => enterPlaceMode("frame"), "Frame")}
          {toolbarButton(<ImagePlus className="h-4 w-4" />, false, () => fileInputRef.current?.click(), "Add image")}
          {toolbarButton(<Layers className="h-4 w-4" />, shapePickerOpen, () => setShapePickerOpen((v) => !v), "More shapes — cards, charts, dashboards, timelines…")}

          {toolbarDivider}

          <button
            type="button"
            onClick={() => handleAutoLayout("LR")}
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Auto-organize diagram hierarchy"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            Tidy Up
          </button>

          <button
            type="button"
            onClick={toggleRenderMode}
            className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all ${
              doc.renderMode === "sketchy"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
            title="Toggle between Clean Vector and Hand-Drawn Sketchy rendering"
          >
            {doc.renderMode === "sketchy" ? <Feather className="h-3.5 w-3.5" /> : <PenLine className="h-3.5 w-3.5" />}
            {doc.renderMode === "sketchy" ? "Sketchy" : "Clean"}
          </button>

          <button
            type="button"
            onClick={() => {
              if (doc.presentationMode) exitPresentationMode();
              else enterPresentationMode();
            }}
            className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all ${
              doc.presentationMode
                ? "bg-indigo-500 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
            title="Toggle Interactive Prototype Presentation Mode"
          >
            {doc.presentationMode ? <SquareIcon className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {doc.presentationMode ? "Stop" : "Present"}
          </button>

          <button
            type="button"
            onClick={handleExportSvg}
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Download pure vector SVG"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      )}

      {/* ─── Shape Picker Flyout ─────────────────────────────────────────────
          draw.io-style library covering all 29 shapes the canvas can render —
          the 11 toolbar buttons above only reach the basic primitives; cards,
          tables, dashboards, charts, mindmaps, timelines and every other macro
          shape were previously reachable only by asking the AI for one. */}
      {!readOnly && shapePickerOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShapePickerOpen(false)} />
          <div className="absolute bottom-16 left-1/2 z-40 flex max-h-[60%] w-[420px] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-white/50 bg-white/85 shadow-2xl shadow-slate-900/20 backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-900/85">
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-900/5 p-2.5 dark:border-white/5">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <input
                autoFocus
                value={shapePickerQuery}
                onChange={(e) => setShapePickerQuery(e.target.value)}
                placeholder="Search shapes…"
                className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={() => setShapePickerOpen(false)}
                aria-label="Close"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-900/5 dark:hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
              {(() => {
                const q = shapePickerQuery.trim().toLowerCase();
                const matches = (e: ShapeCatalogEntry) =>
                  !q || e.label.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
                const visibleCategories = SHAPE_CATEGORIES
                  .map((cat) => ({ cat, entries: catalogByCategory(cat.id).filter(matches) }))
                  .filter((g) => g.entries.length > 0);
                if (visibleCategories.length === 0) {
                  return <p className="px-1 py-6 text-center text-xs text-slate-400">No shapes match “{shapePickerQuery}”.</p>;
                }
                return visibleCategories.map(({ cat, entries }) => (
                  <div key={cat.id} className="mb-3 last:mb-0">
                    <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{cat.label}</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {entries.map((entry) => {
                        const Icon = CATALOG_ICONS[entry.icon] ?? Shapes;
                        return (
                          <button
                            key={entry.type}
                            type="button"
                            title={entry.description}
                            onClick={() => insertCatalogShapeAtCenter(entry)}
                            className="flex flex-col items-center gap-1 rounded-lg p-2 text-center transition-colors hover:bg-indigo-500/10"
                          >
                            <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                            <span className="text-[9.5px] leading-tight text-slate-500 dark:text-slate-400">{entry.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </>
      )}

      {/* ─── Zoom Controls ───────────────────────────────────────────────── */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-0.5 rounded-2xl border border-white/50 bg-white/50 p-1 shadow-xl shadow-slate-900/10 backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-900/50">
        <button
          type="button"
          onClick={() => zoomBy(1 / ZOOM_STEP)}
          title="Zoom out"
          aria-label="Zoom out"
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={resetZoom}
          title="Reset zoom to 100% (⌘0)"
          className="min-w-[3.25rem] rounded-md px-1.5 py-1 text-center text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {Math.round(viewport.scale * 100)}%
        </button>
        <button
          type="button"
          onClick={() => zoomBy(ZOOM_STEP)}
          title="Zoom in"
          aria-label="Zoom in"
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-700 mx-0.5" />
        <button
          type="button"
          onClick={() => zoomToFit(doc.shapes)}
          title="Zoom to fit (⌘0 resets to 100%)"
          aria-label="Zoom to fit"
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Maximize className="h-4 w-4" />
        </button>
      </div>

      {/* ─── Present Mode frame counter ─────────────────────────────────── */}
      {doc.presentationMode && presentationFrames.length > 0 && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/50 bg-white/50 p-1 shadow-xl shadow-slate-900/10 backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={() => stepPresentation(-1)}
            disabled={presentFrameIndex === 0}
            title="Previous frame (Left Arrow)"
            aria-label="Previous frame"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[3.25rem] px-1.5 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
            {Math.min(presentFrameIndex + 1, presentationFrames.length)} / {presentationFrames.length}
          </span>
          <button
            type="button"
            onClick={() => stepPresentation(1)}
            disabled={presentFrameIndex >= presentationFrames.length - 1}
            title="Next frame (Right Arrow / Space)"
            aria-label="Next frame"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ─── Floating Quick-Style & Format Bar ────────────────────────────── */}
      {!readOnly && selBounds && selectedShapes.length > 0 && !editingShapeId && (
        <div
          className="absolute z-30 flex items-center gap-1.5 rounded-xl border border-white/50 bg-white/70 px-2 py-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-900/70"
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

          {styleDivider}

          {/* Stroke Color Swatches */}
          <div className="flex items-center gap-1">
            {["#1e293b", "#94a3b8", "5", "4", "3", "1", "6"].map((c) => {
              const hex = resolveColor(c) ?? c;
              const isActive = primarySelected?.stroke === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => updateSelectedProps({ stroke: c })}
                  className={`h-4 w-4 rounded-full border border-slate-300 transition-transform ${
                    isActive ? "scale-125 ring-2 ring-indigo-500" : "hover:scale-110"
                  }`}
                  style={{ background: hex }}
                  title={`Stroke ${c}`}
                />
              );
            })}
          </div>

          {styleDivider}

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
                title={`${w}px stroke`}
                className={`rounded-md px-1.5 py-1 text-[10px] font-semibold transition-colors ${
                  primarySelected?.strokeWidth === w
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10"
                }`}
              >
                {w}px
              </button>
            ))}
          </div>

          {styleDivider}

          {styleIconButton(
            <Minus className="h-3.5 w-3.5" style={primarySelected?.strokeDash === "dashed" ? { strokeDasharray: 3 } : undefined} />,
            primarySelected?.strokeDash === "dashed",
            () => updateSelectedProps((s) => ({ ...s, strokeDash: s.strokeDash === "dashed" ? "solid" : "dashed" })),
            "Toggle dashed line"
          )}

          {styleIconButton(
            <Minus className="h-3.5 w-3.5" style={{ strokeDasharray: 1.5 }} />,
            primarySelected?.strokeDash === "dotted",
            () => updateSelectedProps((s) => ({ ...s, strokeDash: s.strokeDash === "dotted" ? "solid" : "dotted" })),
            "Toggle dotted line"
          )}

          {styleDivider}

          {/* Opacity — live-preview per tick, commit once on release (see
              updateSelectedOpacityLive / commitSelectedOpacity above). */}
          <div className="flex items-center gap-1 px-0.5">
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={Math.round((primarySelected?.opacity ?? 1) * 100)}
              onChange={(e) => updateSelectedOpacityLive(Number(e.target.value) / 100)}
              onPointerUp={commitSelectedOpacity}
              onMouseUp={commitSelectedOpacity}
              onKeyUp={commitSelectedOpacity}
              className="h-1 w-14 accent-indigo-500"
              title="Opacity"
            />
            <span className="w-7 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {Math.round((primarySelected?.opacity ?? 1) * 100)}%
            </span>
          </div>

          {styleDivider}

          {styleIconButton(
            <Bold className="h-3.5 w-3.5" />,
            Boolean(primarySelected?.text?.bold),
            () => updateSelectedProps((s) => ({ ...s, text: { ...(s.text ?? { content: "" }), bold: !s.text?.bold } })),
            "Toggle bold"
          )}

          {/* Text Align — block-level text.align, already honored by both render
              paths; this was the only UI gap. */}
          {selectedShapes.length > 0 &&
            selectedShapes.every((s) => s.type !== "arrow" && s.type !== "line" && s.type !== "path") && (
              <div className="flex items-center gap-0.5">
                {([
                  ["left", AlignLeft],
                  ["center", AlignCenter],
                  ["right", AlignRight],
                ] as const).map(([align, Icon]) =>
                  styleIconButton(
                    <Icon className="h-3.5 w-3.5" />,
                    (primarySelected?.text?.align ?? "left") === align,
                    () =>
                      updateSelectedProps((s) => ({ ...s, text: { ...(s.text ?? { content: "" }), align } })),
                    `Align text ${align}`
                  )
                )}
              </div>
            )}

          {/* Text Color Swatches — block-level text.color, already honored by
              both render paths; this was the only UI gap. */}
          {selectedShapes.length > 0 &&
            selectedShapes.every((s) => s.type !== "arrow" && s.type !== "line" && s.type !== "path") && (
              <>
                {styleDivider}
                <div className="flex items-center gap-1">
                  {["#0f172a", "#ffffff", "5", "4", "3", "1", "6"].map((c) => {
                    const hex = resolveColor(c) ?? c;
                    const isActive = primarySelected?.text?.color === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          updateSelectedProps((s) => ({ ...s, text: { ...(s.text ?? { content: "" }), color: c } }))
                        }
                        className={`h-4 w-4 rounded-full border border-slate-300 transition-transform ${
                          isActive ? "scale-125 ring-2 ring-indigo-500" : "hover:scale-110"
                        }`}
                        style={{ background: hex }}
                        title={`Text color ${c}`}
                      />
                    );
                  })}
                </div>
              </>
            )}

          {/* Font Size — only meaningful for shapes that render a .text block;
              arrows/lines/paths carry their own label/stroke, not this. */}
          {selectedShapes.length > 0 &&
            selectedShapes.every((s) => s.type !== "arrow" && s.type !== "line" && s.type !== "path") && (
              <>
                {styleDivider}
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => bumpSelectedFontSize(-2)}
                    title="Decrease font size"
                    className="flex h-5 w-5 items-center justify-center rounded text-slate-600 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center text-[10px] font-medium text-slate-600 dark:text-slate-300">
                    {primarySelected?.text?.fontSize ?? 14}
                  </span>
                  <button
                    type="button"
                    onClick={() => bumpSelectedFontSize(2)}
                    title="Increase font size"
                    className="flex h-5 w-5 items-center justify-center rounded text-slate-600 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </>
            )}

          {/* Arrow-only: arrowhead presence at each end, and line routing.
              Schema only supports booleans here (arrowStart/arrowEnd), not a
              style enum, so these are plain on/off toggles, not dropdowns. */}
          {selectedShapes.length > 0 && selectedShapes.every((s) => s.type === "arrow") && (
            <>
              {styleDivider}
              {styleIconButton(
                <ArrowLeft className="h-3.5 w-3.5" />,
                Boolean((primarySelected as ArrowShape | undefined)?.arrowStart),
                () => updateSelectedProps((s) => ({ ...s, arrowStart: !(s as ArrowShape).arrowStart }) as CanvasShape),
                "Toggle start arrowhead"
              )}
              {styleIconButton(
                <ArrowRight className="h-3.5 w-3.5" />,
                (primarySelected as ArrowShape | undefined)?.arrowEnd !== false,
                () => updateSelectedProps((s) => ({ ...s, arrowEnd: (s as ArrowShape).arrowEnd === false }) as CanvasShape),
                "Toggle end arrowhead"
              )}
            </>
          )}

          {selectedShapes.length > 0 && selectedShapes.every((s) => s.type === "arrow" || s.type === "line") && (
            <>
              {styleDivider}
              {styleIconButton(
                <Minus className="h-3.5 w-3.5" />,
                !(primarySelected as ArrowShape | undefined)?.routing || (primarySelected as ArrowShape).routing === "straight",
                () => updateSelectedProps((s) => ({ ...s, routing: "straight" }) as CanvasShape),
                "Straight routing"
              )}
              {styleIconButton(
                <Spline className="h-3.5 w-3.5" />,
                (primarySelected as ArrowShape | undefined)?.routing === "curved",
                () => updateSelectedProps((s) => ({ ...s, routing: "curved" }) as CanvasShape),
                "Curved routing"
              )}
              {styleIconButton(
                <CornerDownRight className="h-3.5 w-3.5" />,
                (primarySelected as ArrowShape | undefined)?.routing === "orthogonal",
                () => updateSelectedProps((s) => ({ ...s, routing: "orthogonal" }) as CanvasShape),
                "Orthogonal routing"
              )}
            </>
          )}

          {/* Multi-Selection Alignment Tools */}
          {selectedShapes.length >= 2 && (
            <>
              {styleDivider}
              {styleIconButton(<AlignLeft className="h-3.5 w-3.5" />, false, () => alignSelected("left"), "Align left")}
              {styleIconButton(<AlignCenter className="h-3.5 w-3.5" />, false, () => alignSelected("center"), "Align center")}
              {styleIconButton(<AlignRight className="h-3.5 w-3.5" />, false, () => alignSelected("right"), "Align right")}
              {styleIconButton(<AlignHorizontalDistributeCenter className="h-3.5 w-3.5" />, false, () => alignSelected("distribute-h"), "Distribute horizontally")}
              {styleIconButton(<AlignStartVertical className="h-3.5 w-3.5" />, false, () => alignSelected("top"), "Align top")}
              {styleIconButton(<AlignCenterVertical className="h-3.5 w-3.5" />, false, () => alignSelected("middle"), "Align middle")}
              {styleIconButton(<AlignEndVertical className="h-3.5 w-3.5" />, false, () => alignSelected("bottom"), "Align bottom")}
              {styleIconButton(<AlignVerticalDistributeCenter className="h-3.5 w-3.5" />, false, () => alignSelected("distribute-v"), "Distribute vertically")}
            </>
          )}

          {styleDivider}

          {styleIconButton(<BringToFront className="h-3.5 w-3.5" />, false, bringSelectionToFront, "Bring to front")}
          {styleIconButton(<SendToBack className="h-3.5 w-3.5" />, false, sendSelectionToBack, "Send to back")}

          {primarySelected && selectedShapes.length === 1 && primarySelected.type !== "frame" && (
            <>
              {styleDivider}
              <select
                className="text-[10px] py-1 px-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 w-28"
                value={primarySelected.onClickNavigateToFrameId || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  updateSelectedProps((s) => ({
                    ...s,
                    onClickNavigateToFrameId: val === "" ? undefined : val
                  }));
                }}
              >
                <option value="">No Link</option>
                {doc.shapes.filter(s => s.type === "frame").map(f => (
                  <option key={f.id} value={f.id}>Link: {f.name}</option>
                ))}
              </select>
            </>
          )}
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
        onMouseLeave={handleStageMouseLeave}
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
              mode,
              startEditingTableCell
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
          {arrowEditDraft && arrowEditFixedPoint && (
            <Line
              points={[arrowEditFixedPoint.x, arrowEditFixedPoint.y, arrowEditDraft.point.x, arrowEditDraft.point.y]}
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

        {/* Hover Connection Dots — draw.io-style: hover a shape in select mode
            and drag from one of its four edge dots to draw a bound arrow,
            with no need to switch to the Arrow tool first. */}
        {connectDotsBounds && (
          <Layer>
            {edgeAnchorPoints(connectDotsBounds).map((p) => (
              <KonvaCircle
                key={p.anchor}
                x={p.x}
                y={p.y}
                radius={5}
                fill="#ffffff"
                stroke="#6366f1"
                strokeWidth={1.5}
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  startConnectionDrag(connectDotsShape!.id, p.anchor, { x: p.x, y: p.y });
                }}
                onMouseEnter={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = "crosshair";
                }}
                onMouseLeave={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = "";
                }}
              />
            ))}
          </Layer>
        )}

        {/* Arrow Endpoint Grab Dots — hovering an existing arrow shows two
            dots at its ends; dragging one rebinds that end to a new point or
            shape. Previously an arrow's connections were fixed at creation —
            fixing a wrong endpoint meant deleting the arrow and redrawing it. */}
        {hoveredArrowPoints && (
          <Layer>
            {(["start", "end"] as const).map((end) => {
              const p = hoveredArrowPoints[end];
              return (
                <KonvaCircle
                  key={end}
                  x={p.x}
                  y={p.y}
                  radius={5}
                  fill="#ffffff"
                  stroke="#6366f1"
                  strokeWidth={1.5}
                  onMouseDown={(e) => {
                    e.cancelBubble = true;
                    startArrowEndpointDrag(hoveredArrowShape!.id, end, p);
                  }}
                  onMouseEnter={(e) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = "crosshair";
                  }}
                  onMouseLeave={(e) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = "";
                  }}
                />
              );
            })}
          </Layer>
        )}
      </Stage>

      {/* ─── Multiplayer Peer Cursors ────────────────────────────────────── */}
      {/* DOM overlay, not Konva nodes — this file's rule that exactly one Konva
          node per shape carries the shape id would make peer dots a special
          case to exempt every time; a plain absolutely-positioned div is simpler
          and never touches shape hit-testing. */}
      {peers.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          {peers
            .filter((peer): peer is PeerInfo & { cursor: { x: number; y: number } } => peer.cursor !== null)
            .map((peer) => (
              <div
                key={peer.clientId}
                className="absolute flex items-center gap-1 transition-[left,top] duration-75 ease-linear"
                style={{
                  left: peer.cursor.x * viewport.scale + viewport.x,
                  top: peer.cursor.y * viewport.scale + viewport.y,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))" }}>
                  <path d="M2 2 L15 8 L9 9.5 L7 15.5 Z" fill={peer.color} stroke="white" strokeWidth="1" strokeLinejoin="round" />
                </svg>
                <span
                  className="whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow"
                  style={{ backgroundColor: peer.color }}
                >
                  {peer.name}
                </span>
              </div>
            ))}
        </div>
      )}

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
            } else if (editingTableCell && editingShape.type === "table" && e.key === "Tab") {
              // Tab commits the current cell and hops to the next one (name ->
              // type -> next row's name), wrapping across rows; Shift+Tab goes
              // backward. Falling off either end exits edit mode entirely.
              e.preventDefault();
              const table = editingShape as TableShape;
              const newDoc = applyTableCellEdit(doc, table.id, editingTableCell, editingValue);
              setDoc(newDoc);
              commitChanges(newDoc);
              const updatedTable = newDoc.shapes.find((s) => s.id === table.id) as TableShape | undefined;
              const next = updatedTable ? nextTableCell(updatedTable, editingTableCell, e.shiftKey) : null;
              if (updatedTable && next) {
                setEditingTableCell(next);
                setEditingValue(readTableCellValue(updatedTable, next));
              } else {
                setEditingShapeId(null);
                setEditingTableCell(null);
              }
            } else if (
              editingTableCell
                ? e.key === "Enter" && !e.shiftKey
                : e.key === "Enter" && (e.metaKey || e.ctrlKey)
            ) {
              // Table cells are single-line fields, so plain Enter commits and
              // exits (matching every other single-line commit in this file);
              // other shapes keep the multi-line Cmd/Ctrl+Enter convention.
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
            fontSize: editingTableCell
              ? 11 * viewport.scale
              : (editingShape.text?.fontSize ?? 14) * viewport.scale,
            fontFamily: editingTableCell
              ? "'JetBrains Mono', monospace"
              : editingShape.text?.fontFamily ?? "Inter, Arial, sans-serif",
            color: editingShape.text?.color ?? "#1e293b",
            textAlign: editingTableCell
              ? editingTableCell.kind === "column" && editingTableCell.field === "type"
                ? "right"
                : "left"
              : editingShape.text?.align ?? (editingShape.type === "text" ? "left" : "center"),
            fontWeight: editingTableCell?.kind === "tableName" || editingShape.text?.bold ? "bold" : "normal",
            background: editingShape.type === "sticky" ? "#fef08a" : "rgba(255,255,255,0.95)",
            border: "2px solid #4f46e5",
            borderRadius: 4,
            outline: "none",
            resize: "none",
            padding: 4,
            margin: 0,
            boxSizing: "border-box",
            transform: editingShape.rotation ? `rotate(${editingShape.rotation}deg)` : undefined,
            transformOrigin: "center center",
            zIndex: 50,
          }}
        />
      )}
    </div>
  );
}
