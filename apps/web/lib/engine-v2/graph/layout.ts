import type {
  GraphDirection,
  GraphDocument,
  GraphEdge,
  GraphLayoutOptions,
  GraphNode,
  GraphPoint,
  LayoutGraph,
  LayoutGraphEdge,
  LayoutGraphNode,
} from "./types.ts";

const DEFAULT_NODE_WIDTH = 188;
const DEFAULT_NODE_HEIGHT = 76;

function finiteSize(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value! > 0 ? Math.round(value!) : fallback;
}

function nodeSize(node: GraphNode): { width: number; height: number } {
  const fieldHeight = node.kind === "entity" && node.fields?.length
    ? 54 + node.fields.length * 26
    : DEFAULT_NODE_HEIGHT;
  const kindWidth = node.kind === "database" ? 168 : node.kind === "decision" ? 136 : DEFAULT_NODE_WIDTH;
  const kindHeight = node.kind === "decision" ? 112 : fieldHeight;
  return {
    width: finiteSize(node.width, kindWidth),
    height: finiteSize(node.height, kindHeight),
  };
}

function stronglyConnectedComponents(
  nodeIds: string[],
  outgoing: Map<string, string[]>,
): string[][] {
  let nextIndex = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const inStack = new Set<string>();
  const components: string[][] = [];

  const visit = (id: string) => {
    indices.set(id, nextIndex);
    lowLinks.set(id, nextIndex);
    nextIndex += 1;
    stack.push(id);
    inStack.add(id);

    for (const target of outgoing.get(id) ?? []) {
      if (!indices.has(target)) {
        visit(target);
        lowLinks.set(id, Math.min(lowLinks.get(id)!, lowLinks.get(target)!));
      } else if (inStack.has(target)) {
        lowLinks.set(id, Math.min(lowLinks.get(id)!, indices.get(target)!));
      }
    }

    if (lowLinks.get(id) !== indices.get(id)) return;
    const component: string[] = [];
    while (stack.length) {
      const member = stack.pop()!;
      inStack.delete(member);
      component.push(member);
      if (member === id) break;
    }
    components.push(component.sort());
  };

  for (const id of nodeIds) {
    if (!indices.has(id)) visit(id);
  }
  return components;
}

function assignRanks(nodeIds: string[], edges: GraphEdge[]): Map<string, number> {
  const outgoing = new Map(nodeIds.map((id) => [id, [] as string[]]));
  for (const edge of edges) outgoing.get(edge.source)!.push(edge.target);
  for (const targets of outgoing.values()) targets.sort();

  const components = stronglyConnectedComponents(nodeIds, outgoing);
  const componentByNode = new Map<string, number>();
  components.forEach((component, index) => component.forEach((id) => componentByNode.set(id, index)));

  const componentOutgoing = new Map<number, Set<number>>();
  const indegree = new Map<number, number>();
  const ranks = new Map<number, number>();
  components.forEach((_, index) => {
    componentOutgoing.set(index, new Set());
    indegree.set(index, 0);
    ranks.set(index, 0);
  });

  for (const edge of edges) {
    const source = componentByNode.get(edge.source)!;
    const target = componentByNode.get(edge.target)!;
    if (source === target || componentOutgoing.get(source)!.has(target)) continue;
    componentOutgoing.get(source)!.add(target);
    indegree.set(target, indegree.get(target)! + 1);
  }

  const componentKey = (index: number) => components[index][0];
  const ready = components
    .map((_, index) => index)
    .filter((index) => indegree.get(index) === 0)
    .sort((a, b) => componentKey(a).localeCompare(componentKey(b)));

  while (ready.length) {
    const current = ready.shift()!;
    const targets = [...componentOutgoing.get(current)!]
      .sort((a, b) => componentKey(a).localeCompare(componentKey(b)));
    for (const target of targets) {
      ranks.set(target, Math.max(ranks.get(target)!, ranks.get(current)! + 1));
      indegree.set(target, indegree.get(target)! - 1);
      if (indegree.get(target) === 0) {
        ready.push(target);
        ready.sort((a, b) => componentKey(a).localeCompare(componentKey(b)));
      }
    }
  }

  return new Map(nodeIds.map((id) => [id, ranks.get(componentByNode.get(id)!)!]));
}

function orderRanks(nodeIds: string[], edges: GraphEdge[], ranks: Map<string, number>): string[][] {
  const layers: string[][] = [];
  for (const id of nodeIds) {
    const rank = ranks.get(id)!;
    (layers[rank] ??= []).push(id);
  }
  const incoming = new Map(nodeIds.map((id) => [id, [] as string[]]));
  for (const edge of edges) incoming.get(edge.target)!.push(edge.source);

  layers.forEach((layer, rank) => {
    const previousOrder = new Map((layers[rank - 1] ?? []).map((id, index) => [id, index]));
    layer.sort((a, b) => {
      const parentsA = incoming.get(a)!.filter((id) => ranks.get(id) === rank - 1);
      const parentsB = incoming.get(b)!.filter((id) => ranks.get(id) === rank - 1);
      const barycenter = (parents: string[]) => parents.length
        ? parents.reduce((sum, id) => sum + previousOrder.get(id)!, 0) / parents.length
        : Number.POSITIVE_INFINITY;
      return barycenter(parentsA) - barycenter(parentsB) || a.localeCompare(b);
    });
  });
  return layers;
}

function dedupePoints(points: GraphPoint[]): GraphPoint[] {
  return points.filter((point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
}

function longestSegmentMidpoint(points: GraphPoint[]): GraphPoint {
  let best = { length: -1, point: points[0] };
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
    if (length > best.length) {
      best = { length, point: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } };
    }
  }
  return best.point;
}

function routeEdge(
  edge: GraphEdge,
  source: LayoutGraphNode,
  target: LayoutGraphNode,
  direction: GraphDirection,
  lane: number,
): LayoutGraphEdge {
  const offset = lane * 10;
  let points: GraphPoint[];
  if (direction === "TB") {
    const forward = target.rank > source.rank;
    const start = { x: source.x + source.width / 2 + offset, y: source.y + source.height };
    const end = { x: target.x + target.width / 2 + offset, y: target.y };
    if (forward) {
      const middle = Math.round((start.y + end.y) / 2);
      points = [start, { x: start.x, y: middle }, { x: end.x, y: middle }, end];
    } else {
      const outside = Math.max(source.x + source.width, target.x + target.width) + 38 + Math.abs(lane) * 14;
      points = [start, { x: start.x, y: start.y + 20 }, { x: outside, y: start.y + 20 }, { x: outside, y: end.y - 20 }, { x: end.x, y: end.y - 20 }, end];
    }
  } else {
    const forward = target.rank > source.rank;
    const start = { x: source.x + source.width, y: source.y + source.height / 2 + offset };
    const end = { x: target.x, y: target.y + target.height / 2 + offset };
    if (forward) {
      const middle = Math.round((start.x + end.x) / 2);
      points = [start, { x: middle, y: start.y }, { x: middle, y: end.y }, end];
    } else {
      const outside = Math.max(source.y + source.height, target.y + target.height) + 38 + Math.abs(lane) * 14;
      points = [start, { x: start.x + 20, y: start.y }, { x: start.x + 20, y: outside }, { x: end.x - 20, y: outside }, { x: end.x - 20, y: end.y }, end];
    }
  }

  points = dedupePoints(points.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) })));
  const first = points[0];
  const last = points[points.length - 1];
  const second = points[Math.min(1, points.length - 1)];
  const beforeLast = points[Math.max(0, points.length - 2)];
  return {
    ...edge,
    kind: edge.kind ?? "flow",
    points,
    labelPoint: edge.label ? longestSegmentMidpoint(points) : undefined,
    sourceLabelPoint: edge.sourceLabel ? { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 } : undefined,
    targetLabelPoint: edge.targetLabel ? { x: (last.x + beforeLast.x) / 2, y: (last.y + beforeLast.y) / 2 } : undefined,
  };
}

export function layoutGraph(document: GraphDocument, options: GraphLayoutOptions = {}): LayoutGraph {
  const direction = options.direction ?? document.direction ?? "TB";
  const layerGap = finiteSize(options.layerGap, 104);
  const nodeGap = finiteSize(options.nodeGap, 44);
  const padding = finiteSize(options.padding, 48);
  const warnings: string[] = [];
  const seenNodes = new Set<string>();
  const nodes = [...document.nodes].sort((a, b) => a.id.localeCompare(b.id)).filter((node) => {
    if (!node.id || seenNodes.has(node.id)) {
      warnings.push(`Skipped node with missing or duplicate id: ${node.id || "(empty)"}`);
      return false;
    }
    seenNodes.add(node.id);
    return true;
  });
  const seenEdges = new Set<string>();
  const edges = [...document.edges].sort((a, b) => a.id.localeCompare(b.id)).filter((edge) => {
    if (!edge.id || seenEdges.has(edge.id)) {
      warnings.push(`Skipped edge with missing or duplicate id: ${edge.id || "(empty)"}`);
      return false;
    }
    seenEdges.add(edge.id);
    if (!seenNodes.has(edge.source) || !seenNodes.has(edge.target)) {
      warnings.push(`Skipped edge ${edge.id}: endpoint not found`);
      return false;
    }
    return true;
  });

  if (!nodes.length) {
    return { name: document.name, direction, width: padding * 2, height: padding * 2, nodes: [], edges: [], warnings };
  }

  const nodeIds = nodes.map((node) => node.id);
  const ranks = assignRanks(nodeIds, edges);
  const layers = orderRanks(nodeIds, edges, ranks);
  const sizes = new Map(nodes.map((node) => [node.id, nodeSize(node)]));
  const layerCrossSizes = layers.map((layer) => layer.reduce((sum, id, index) => sum + sizes.get(id)![direction === "TB" ? "width" : "height"] + (index ? nodeGap : 0), 0));
  const maxCrossSize = Math.max(...layerCrossSizes, 0);
  const laidNodes: LayoutGraphNode[] = [];
  let mainCursor = padding;

  layers.forEach((layer, rank) => {
    const mainSize = Math.max(...layer.map((id) => sizes.get(id)![direction === "TB" ? "height" : "width"]));
    let crossCursor = padding + (maxCrossSize - layerCrossSizes[rank]) / 2;
    for (const id of layer) {
      const node = nodes.find((candidate) => candidate.id === id)!;
      const size = sizes.get(id)!;
      laidNodes.push({
        ...node,
        x: Math.round(direction === "TB" ? crossCursor : mainCursor + (mainSize - size.width) / 2),
        y: Math.round(direction === "TB" ? mainCursor + (mainSize - size.height) / 2 : crossCursor),
        width: size.width,
        height: size.height,
        rank,
      });
      crossCursor += size[direction === "TB" ? "width" : "height"] + nodeGap;
    }
    mainCursor += mainSize + layerGap;
  });

  const byId = new Map(laidNodes.map((node) => [node.id, node]));
  const pairCounts = new Map<string, number>();
  const laidEdges = edges.map((edge) => {
    const key = `${edge.source}\u0000${edge.target}`;
    const index = pairCounts.get(key) ?? 0;
    pairCounts.set(key, index + 1);
    const lane = index === 0 ? 0 : Math.ceil(index / 2) * (index % 2 ? 1 : -1);
    return routeEdge(edge, byId.get(edge.source)!, byId.get(edge.target)!, direction, lane);
  });

  const pointXs = laidEdges.flatMap((edge) => edge.points.map((point) => point.x));
  const pointYs = laidEdges.flatMap((edge) => edge.points.map((point) => point.y));
  const width = Math.ceil(Math.max(...laidNodes.map((node) => node.x + node.width), ...pointXs, padding) + padding);
  const height = Math.ceil(Math.max(...laidNodes.map((node) => node.y + node.height), ...pointYs, padding) + padding);
  return { name: document.name, direction, width, height, nodes: laidNodes, edges: laidEdges, warnings };
}
