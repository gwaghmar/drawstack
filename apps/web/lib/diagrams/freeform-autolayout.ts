import dagre from "@dagrejs/dagre";
import {
  type CanvasDocument,
  type CanvasShape,
  type ArrowShape,
  getShapeBounds,
  isBoundEndpoint,
} from "./freeform-canvas.ts";

export type LayoutDirection = "LR" | "TB";

export type AutoLayoutOptions = {
  direction?: LayoutDirection;
  layerGap?: number;
  nodeGap?: number;
  startX?: number;
  startY?: number;
};

export function autoLayoutFreeformDocument(
  doc: CanvasDocument,
  options: AutoLayoutOptions = {}
): CanvasDocument {
  const direction = options.direction ?? "LR";
  const layerGap = options.layerGap ?? 140;
  const nodeGap = options.nodeGap ?? 50;
  const startX = options.startX ?? 60;
  const startY = options.startY ?? 60;

  // Filter out arrows, lines, and frames for layout positioning
  const layoutableShapes = doc.shapes.filter(
    (s) => s.type !== "arrow" && s.type !== "line" && s.type !== "frame" && s.type !== "path"
  ) as Exclude<CanvasShape, ArrowShape>[];

  if (layoutableShapes.length === 0) return doc;

  const shapeMap = new Map<string, typeof layoutableShapes[0]>();
  for (const s of layoutableShapes) {
    shapeMap.set(s.id, s);
  }

  const connectors = doc.shapes.filter((s) => s.type === "arrow" || s.type === "line") as ArrowShape[];

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    nodesep: nodeGap,
    ranksep: layerGap,
    marginx: startX,
    marginy: startY
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const shape of layoutableShapes) {
    const b = getShapeBounds(doc, shape);
    g.setNode(shape.id, { width: b.width, height: b.height });
  }

  for (const connector of connectors) {
    if (isBoundEndpoint(connector.start) && isBoundEndpoint(connector.end)) {
      const fromId = connector.start.shapeId;
      const toId = connector.end.shapeId;
      if (shapeMap.has(fromId) && shapeMap.has(toId) && fromId !== toId) {
        g.setEdge(fromId, toId);
      }
    }
  }

  dagre.layout(g);

  const newPositions = new Map<string, { x: number; y: number }>();
  for (const shape of layoutableShapes) {
    const node = g.node(shape.id);
    if (node) {
      const b = getShapeBounds(doc, shape);
      // Dagre returns the center point of the node; we need top-left.
      newPositions.set(shape.id, {
        x: Math.round(node.x - b.width / 2),
        y: Math.round(node.y - b.height / 2),
      });
    }
  }

  // Update doc shapes. Connectors between laid-out nodes switch to orthogonal
  // routing at the same time -- layered positions with straight diagonal lines
  // read as spaghetti, and the right-angle router is what the layered layout
  // was drawn for. An explicit routing choice on a connector is respected.
  const updatedShapes = doc.shapes.map((s) => {
    if (newPositions.has(s.id)) {
      const pos = newPositions.get(s.id)!;
      return { ...s, x: pos.x, y: pos.y } as CanvasShape;
    }
    if ((s.type === "arrow" || s.type === "line") && s.routing === undefined) {
      const arrow = s as ArrowShape;
      if (
        isBoundEndpoint(arrow.start) &&
        isBoundEndpoint(arrow.end) &&
        newPositions.has(arrow.start.shapeId) &&
        newPositions.has(arrow.end.shapeId)
      ) {
        return { ...s, routing: "orthogonal" } as CanvasShape;
      }
    }
    return s;
  });

  return { ...doc, shapes: updatedShapes };
}
