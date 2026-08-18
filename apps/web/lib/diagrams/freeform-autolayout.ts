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

  // Connections come from arrows AND lines — UML/ERD notation edges are lines,
  // and a layout that ignores them lays those diagrams out as disconnected islands.
  const connectors = doc.shapes.filter((s) => s.type === "arrow" || s.type === "line") as ArrowShape[];
  const adjacency = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const s of layoutableShapes) {
    adjacency.set(s.id, new Set());
    incoming.set(s.id, new Set());
    inDegree.set(s.id, 0);
  }

  for (const connector of connectors) {
    if (isBoundEndpoint(connector.start) && isBoundEndpoint(connector.end)) {
      const fromId = connector.start.shapeId;
      const toId = connector.end.shapeId;
      if (shapeMap.has(fromId) && shapeMap.has(toId) && fromId !== toId) {
        if (!adjacency.get(fromId)!.has(toId)) {
          adjacency.get(fromId)!.add(toId);
          incoming.get(toId)!.add(fromId);
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

  // Order each layer by the average position of its neighbours in the adjacent
  // layer (barycenter), swept both ways. Without this, layer membership is
  // whatever order the traversal happened to visit in, and edges cross wildly.
  const neighborsOf = (id: string) => [...(adjacency.get(id) ?? []), ...(incoming.get(id) ?? [])];

  const sweep = (referenceLayer: string[], target: string[]) => {
    const index = new Map(referenceLayer.map((id, i) => [id, i]));
    const barycenter = new Map<string, number>();
    target.forEach((id, fallback) => {
      const positions = neighborsOf(id)
        .map((n) => index.get(n))
        .filter((v): v is number => v !== undefined);
      barycenter.set(id, positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : fallback);
    });
    target.sort((a, b) => barycenter.get(a)! - barycenter.get(b)!);
  };

  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < layers.length; i++) sweep(layers[i - 1], layers[i]);
    for (let i = layers.length - 2; i >= 0; i--) sweep(layers[i + 1], layers[i]);
  }

  // Compute positions
  const newPositions = new Map<string, { x: number; y: number }>();
  let layerOffset = direction === "LR" ? startX : startY;

  // getShapeBounds falls through to computeDynamicShapeDimensions for any shape
  // missing width/height (the common case for AI-authored shapes) — reading the
  // field directly reads undefined and poisons every downstream position with NaN.
  const boundsOf = (id: string) => getShapeBounds(doc, shapeMap.get(id)! as CanvasShape);

  const breadthOf = (layer: string[]) =>
    layer.reduce((sum, id) => {
      const b = boundsOf(id);
      return sum + (direction === "LR" ? b.height : b.width);
    }, 0) + Math.max(0, (layer.length - 1) * nodeGap);

  // Center every layer on one axis so a wide layer doesn't drag narrow ones
  // to one side; the old code started each layer flush at the same edge.
  const widestBreadth = Math.max(...layers.map(breadthOf));

  for (const layer of layers) {
    let maxLayerThickness = 0;
    for (const id of layer) {
      const b = boundsOf(id);
      maxLayerThickness = Math.max(maxLayerThickness, direction === "LR" ? b.width : b.height);
    }

    let breadthCursor = (direction === "LR" ? startY : startX) + (widestBreadth - breadthOf(layer)) / 2;

    for (const id of layer) {
      const b = boundsOf(id);
      if (direction === "LR") {
        newPositions.set(id, { x: layerOffset, y: Math.round(breadthCursor) });
        breadthCursor += b.height + nodeGap;
      } else {
        newPositions.set(id, { x: Math.round(breadthCursor), y: layerOffset });
        breadthCursor += b.width + nodeGap;
      }
    }

    layerOffset += maxLayerThickness + layerGap;
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
