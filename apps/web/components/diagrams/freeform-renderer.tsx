"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Ellipse, Line, Text } from "react-konva";
import Konva from "konva";
import {
  parseFreeformSource,
  serializeFreeformDocument,
  resolveArrowEndpoint,
  getShapeBounds,
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
  onShapeDragMove?: (shapeId: string, x: number, y: number) => void,
  onShapeDragEnd?: (shapeId: string) => void,
  readOnly?: boolean
): React.ReactNode {
  const commonProps = {
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation ?? 0,
    fill: shape.fill ?? "#ffffff",
    stroke: shape.stroke ?? "#000000",
    strokeWidth: shape.strokeWidth ?? 1,
    opacity: shape.opacity ?? 1,
  };

  // Skip rendering arrows for now as they need special handling
  if (shape.type === "arrow" || shape.type === "line") {
    const arrowShape = shape as ArrowShape;
    const startPoint = resolveArrowEndpoint(doc, arrowShape.start);
    const endPoint = resolveArrowEndpoint(doc, arrowShape.end);
    return (
      <Line
        key={shape.id}
        points={[startPoint.x, startPoint.y, endPoint.x, endPoint.y]}
        stroke={commonProps.stroke}
        strokeWidth={commonProps.strokeWidth}
        opacity={commonProps.opacity}
        listening={false}
      />
    );
  }

  const shapeNode = (() => {
    switch (shape.type) {
      case "rectangle":
      case "sticky":
      case "frame":
        return (
          <Rect
            key={shape.id}
            {...commonProps}
            width={shape.width}
            height={shape.height}
            cornerRadius={shape.type === "rectangle" && "cornerRadius" in shape ? shape.cornerRadius : undefined}
            draggable={!readOnly}
            onClick={(e) => onShapeClick?.(e, shape.id)}
            onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
            onDragMove={(e) => onShapeDragMove?.(shape.id, e.target.x(), e.target.y())}
            onDragEnd={() => onShapeDragEnd?.(shape.id)}
          />
        );

      case "ellipse":
        return (
          <Ellipse
            key={shape.id}
            x={shape.x + shape.width / 2}
            y={shape.y + shape.height / 2}
            radiusX={shape.width / 2}
            radiusY={shape.height / 2}
            rotation={commonProps.rotation}
            fill={commonProps.fill}
            stroke={commonProps.stroke}
            strokeWidth={commonProps.strokeWidth}
            opacity={commonProps.opacity}
            draggable={!readOnly}
            onClick={(e) => onShapeClick?.(e, shape.id)}
            onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
            onDragMove={(e) => {
              const cx = e.target.x();
              const cy = e.target.y();
              onShapeDragMove?.(shape.id, cx - shape.width / 2, cy - shape.height / 2);
            }}
            onDragEnd={() => onShapeDragEnd?.(shape.id)}
          />
        );

      case "diamond":
        return (
          <Rect
            key={shape.id}
            {...commonProps}
            width={shape.width}
            height={shape.height}
            draggable={!readOnly}
            onClick={(e) => onShapeClick?.(e, shape.id)}
            onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
            onDragMove={(e) => onShapeDragMove?.(shape.id, e.target.x(), e.target.y())}
            onDragEnd={() => onShapeDragEnd?.(shape.id)}
          />
        );

      case "text":
        return (
          <Text
            key={shape.id}
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
            draggable={!readOnly}
            onClick={(e) => onShapeClick?.(e, shape.id)}
            onDragStart={() => onShapeDragStart?.(shape.id, shape.x, shape.y)}
            onDragMove={(e) => onShapeDragMove?.(shape.id, e.target.x(), e.target.y())}
            onDragEnd={() => onShapeDragEnd?.(shape.id)}
          />
        );

      default:
        return null;
    }
  })();

  if (!shapeNode) return null;

  // Render selection outline if selected (arrows/lines already handled above)
  if (isSelected) {
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

    return [shapeNode, outlineNode];
  }

  return shapeNode;
}

export function FreeformRenderer({ source, onChange, readOnly }: Props) {
  const [doc, setDoc] = useState<CanvasDocument>(() => {
    const { doc: parsed, errors } = parseFreeformSource(source);
    if (errors.length > 0) return parsed;
    return parsed.shapes.length > 0 ? parsed : FIXTURE_DOCUMENT;
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [dragState, setDragState] = useState<{
    shapeId: string;
    startX: number;
    startY: number;
    initialPositions: Map<string, { x: number; y: number }>;
  } | null>(null);

  const isApplyingRef = useRef(false);
  const lastSourceRef = useRef(source);
  const stageRef = useRef<Konva.Stage>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Sync external source prop to local state
  useEffect(() => {
    if (source === lastSourceRef.current) return;
    isApplyingRef.current = true;
    const { doc: parsed, errors } = parseFreeformSource(source);
    if (errors.length === 0) {
      const newDoc = parsed.shapes.length > 0 ? parsed : FIXTURE_DOCUMENT;
      setDoc(newDoc);
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

  // Keyboard handlers
  useEffect(() => {
    if (readOnly || selectedIds.size === 0) return;

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
  }, [doc, selectedIds, readOnly]);

  const handleShapeClick = (e: Konva.KonvaEventObject<MouseEvent>, shapeId: string) => {
    if (readOnly) return;
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
    if (e.target === e.target.getStage()) {
      setSelectedIds(new Set());
    }
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (readOnly || marquee !== null) return;
    if (e.target !== e.target.getStage()) return;

    const pos = e.target.getStage()!.getPointerPosition();
    if (!pos) return;

    marqueeStartRef.current = { x: pos.x, y: pos.y };
    setMarquee({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y });
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!marqueeStartRef.current || !marquee) return;

    const pos = e.target.getStage()!.getPointerPosition();
    if (!pos) return;

    setMarquee({ ...marquee, x1: pos.x, y1: pos.y });
  };

  const handleStageMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!marquee || !marqueeStartRef.current) {
      marqueeStartRef.current = null;
      return;
    }

    const marqueeRect = {
      x: Math.min(marquee.x0, marquee.x1),
      y: Math.min(marquee.y0, marquee.y1),
      width: Math.abs(marquee.x1 - marquee.x0),
      height: Math.abs(marquee.y1 - marquee.y0),
    };

    const selected = new Set<string>();
    for (const shape of doc.shapes) {
      if (shape.type === "arrow" || shape.type === "line") continue;
      const bounds = getShapeBounds(doc, shape);
      if (aabbOverlap(marqueeRect, bounds)) {
        selected.add(shape.id);
      }
    }

    setSelectedIds(selected);
    setMarquee(null);
    marqueeStartRef.current = null;
  };

  const handleShapeDragStart = (shapeId: string, x: number, y: number) => {
    if (readOnly) return;
    const initialPositions = new Map<string, { x: number; y: number }>();

    if (selectedIds.has(shapeId)) {
      // Move all selected shapes
      for (const shape of doc.shapes) {
        if (selectedIds.has(shape.id) && shape.type !== "arrow" && shape.type !== "line") {
          initialPositions.set(shape.id, { x: shape.x, y: shape.y });
        }
      }
    } else {
      // Single shape drag
      initialPositions.set(shapeId, { x, y });
      setSelectedIds(new Set([shapeId]));
    }

    setDragState({
      shapeId,
      startX: x,
      startY: y,
      initialPositions,
    });
  };

  const handleShapeDragMove = (shapeId: string, x: number, y: number) => {
    if (!dragState) return;

    const dx = x - dragState.startX;
    const dy = y - dragState.startY;

    const newShapes = doc.shapes.map((s) => {
      const initial = dragState.initialPositions.get(s.id);
      if (initial) {
        return { ...s, x: initial.x + dx, y: initial.y + dy };
      }
      return s;
    });

    setDoc({ ...doc, shapes: newShapes });
  };

  const handleShapeDragEnd = () => {
    if (!dragState) return;

    // Commit the final position
    commitChanges(doc);
    setDragState(null);
  };

  const marqueeRect = marquee
    ? {
        x: Math.min(marquee.x0, marquee.x1),
        y: Math.min(marquee.y0, marquee.y1),
        width: Math.abs(marquee.x1 - marquee.x0),
        height: Math.abs(marquee.y1 - marquee.y0),
      }
    : null;

  return (
    <div className="w-full h-full">
      <Stage
        ref={stageRef}
        width={800}
        height={500}
        onClick={handleStageClick}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
      >
        <Layer>
          {doc.shapes.map((shape) =>
            renderShape(
              shape,
              doc,
              selectedIds.has(shape.id),
              handleShapeClick,
              handleShapeDragStart,
              handleShapeDragMove,
              handleShapeDragEnd,
              readOnly
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
        </Layer>
      </Stage>
    </div>
  );
}
