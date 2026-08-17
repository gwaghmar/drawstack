import {
  type CanvasDocument,
  type CanvasShape,
  type ArrowShape,
  type RectShape,
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
  ) as (Exclude<CanvasShape, ArrowShape> & { width: number; height: number })[];

  if (layoutableShapes.length === 0) return doc;

  const shapeMap = new Map<string, typeof layoutableShapes[0]>();
  for (const s of layoutableShapes) {
    shapeMap.set(s.id, s);
  }

  // Build graph adjacency and in-degrees from arrow connections
  const arrows = doc.shapes.filter((s) => s.type === "arrow") as ArrowShape[];
  const adjacency = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const s of layoutableShapes) {
    adjacency.set(s.id, new Set());
    inDegree.set(s.id, 0);
  }

  for (const arrow of arrows) {
    if (isBoundEndpoint(arrow.start) && isBoundEndpoint(arrow.end)) {
      const fromId = arrow.start.shapeId;
      const toId = arrow.end.shapeId;
      if (shapeMap.has(fromId) && shapeMap.has(toId) && fromId !== toId) {
        if (!adjacency.get(fromId)!.has(toId)) {
          adjacency.get(fromId)!.add(toId);
          inDegree.set(toId, (inDegree.get(toId) ?? 0) + 1);
        }
      }
    }
  }

  // Assign layers via topological traversal
  const layers: string[][] = [];
  const assigned = new Set<string>();
  const currentLayer: string[] = [];

  // Roots: in-degree === 0
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      currentLayer.push(id);
      assigned.add(id);
    }
  }

  // If no root found (cycle), pick the first shape
  if (currentLayer.length === 0 && layoutableShapes.length > 0) {
    currentLayer.push(layoutableShapes[0].id);
    assigned.add(layoutableShapes[0].id);
  }

  layers.push(currentLayer);

  let unvisited = layoutableShapes.filter((s) => !assigned.has(s.id));
  while (unvisited.length > 0) {
    const prevLayer = layers[layers.length - 1];
    const nextLayer: string[] = [];

    for (const fromId of prevLayer) {
      for (const toId of adjacency.get(fromId) ?? []) {
        if (!assigned.has(toId)) {
          nextLayer.push(toId);
          assigned.add(toId);
        }
      }
    }

    if (nextLayer.length === 0) {
      // Pick any remaining unvisited node as a new island root
      const nextRoot = unvisited[0];
      nextLayer.push(nextRoot.id);
      assigned.add(nextRoot.id);
    }

    layers.push(nextLayer);
    unvisited = layoutableShapes.filter((s) => !assigned.has(s.id));
  }

  // Compute positions
  const newPositions = new Map<string, { x: number; y: number }>();
  let layerOffset = direction === "LR" ? startX : startY;

  for (const layer of layers) {
    let maxLayerThickness = 0;
    let totalBreadth = 0;

    for (const id of layer) {
      const shape = shapeMap.get(id)!;
      const breadth = direction === "LR" ? shape.height : shape.width;
      const thickness = direction === "LR" ? shape.width : shape.height;
      totalBreadth += breadth;
      maxLayerThickness = Math.max(maxLayerThickness, thickness);
    }
    totalBreadth += Math.max(0, (layer.length - 1) * nodeGap);

    let breadthCursor = (direction === "LR" ? startY : startX);

    for (const id of layer) {
      const shape = shapeMap.get(id)!;
      if (direction === "LR") {
        newPositions.set(id, {
          x: layerOffset,
          y: Math.round(breadthCursor),
        });
        breadthCursor += shape.height + nodeGap;
      } else {
        newPositions.set(id, {
          x: Math.round(breadthCursor),
          y: layerOffset,
        });
        breadthCursor += shape.width + nodeGap;
      }
    }

    layerOffset += maxLayerThickness + layerGap;
  }

  // Update doc shapes
  const updatedShapes = doc.shapes.map((s) => {
    if (newPositions.has(s.id)) {
      const pos = newPositions.get(s.id)!;
      return { ...s, x: pos.x, y: pos.y } as CanvasShape;
    }
    return s;
  });

  return { ...doc, shapes: updatedShapes };
}
