import { finiteSankeyData, polarPoint } from "./chart-layout.ts";
import { isHierarchyDatum, type DeterministicChartDatum, type HierarchyChartDatum } from "./chart-types.ts";

export type HierarchySegment = {
  id: string;
  label: string;
  depth: number;
  value: number;
  start: number;
  end: number;
};

type TreeNode = {
  id: string;
  label: string;
  ownValue: number;
  value: number;
  children: Map<string, TreeNode>;
};

export function finiteHierarchyData(data: DeterministicChartDatum[]): HierarchyChartDatum[] {
  return data.filter(isHierarchyDatum).filter((datum) => datum.path.split("/").every((part) => part.trim().length > 0));
}

export function layoutHierarchy(data: DeterministicChartDatum[]): { segments: HierarchySegment[]; maxDepth: number } {
  const root: TreeNode = { id: "", label: "", ownValue: 0, value: 0, children: new Map() };
  for (const datum of finiteHierarchyData(data)) {
    let current = root;
    const parts = datum.path.split("/").map((part) => part.trim());
    for (const part of parts) {
      const id = current.id ? `${current.id}/${part}` : part;
      let child = current.children.get(part);
      if (!child) {
        child = { id, label: part, ownValue: 0, value: 0, children: new Map() };
        current.children.set(part, child);
      }
      current = child;
    }
    current.ownValue += datum.value;
  }
  const total = (node: TreeNode): number => {
    const childValue = [...node.children.values()].reduce((sum, child) => sum + total(child), 0);
    node.value = node.ownValue + childValue;
    return node.value;
  };
  total(root);
  const segments: HierarchySegment[] = [];
  const visit = (node: TreeNode, depth: number, start: number, end: number) => {
    if (node !== root) segments.push({ id: node.id, label: node.label, depth, value: node.value, start, end });
    let cursor = start;
    for (const child of node.children.values()) {
      const span = (end - start) * child.value / Math.max(node.value, 1);
      visit(child, depth + 1, cursor, cursor + span);
      cursor += span;
    }
  };
  visit(root, 0, 0, 1);
  return { segments, maxDepth: Math.max(0, ...segments.map((segment) => segment.depth)) };
}

export function annularSectorPath(cx: number, cy: number, inner: number, outer: number, start: number, end: number): string {
  const startAngle = -Math.PI / 2 + start * Math.PI * 2;
  const endAngle = -Math.PI / 2 + end * Math.PI * 2;
  const outerStart = polarPoint(cx, cy, outer, startAngle);
  if (end - start >= 0.999999) {
    const outerMiddle = polarPoint(cx, cy, outer, startAngle + Math.PI);
    const innerStart = polarPoint(cx, cy, inner, startAngle);
    const innerMiddle = polarPoint(cx, cy, inner, startAngle + Math.PI);
    return `M${outerStart.x},${outerStart.y} A${outer},${outer} 0 1 1 ${outerMiddle.x},${outerMiddle.y} A${outer},${outer} 0 1 1 ${outerStart.x},${outerStart.y} L${innerStart.x},${innerStart.y} A${inner},${inner} 0 1 0 ${innerMiddle.x},${innerMiddle.y} A${inner},${inner} 0 1 0 ${innerStart.x},${innerStart.y} Z`;
  }
  const outerEnd = polarPoint(cx, cy, outer, endAngle);
  const innerEnd = polarPoint(cx, cy, inner, endAngle);
  const innerStart = polarPoint(cx, cy, inner, startAngle);
  const large = end - start > 0.5 ? 1 : 0;
  return `M${outerStart.x},${outerStart.y} A${outer},${outer} 0 ${large} 1 ${outerEnd.x},${outerEnd.y} L${innerEnd.x},${innerEnd.y} A${inner},${inner} 0 ${large} 0 ${innerStart.x},${innerStart.y} Z`;
}

export function chordGeometry(data: DeterministicChartDatum[], cx: number, cy: number, radius: number) {
  const links = finiteSankeyData(data);
  const names = [...new Set(links.flatMap((link) => [link.source, link.target]))];
  const totals = names.map((name) => links.reduce((sum, link) => sum + (link.source === name || link.target === name ? link.value : 0), 0));
  const grandTotal = totals.reduce((sum, value) => sum + value, 0);
  let cursor = -Math.PI / 2;
  const nodes = names.map((name, index) => {
    const span = Math.PI * 2 * totals[index] / Math.max(grandTotal, 1);
    const node = { name, start: cursor, end: cursor + span, point: polarPoint(cx, cy, radius, cursor + span / 2), value: totals[index] };
    cursor += span;
    return node;
  });
  const byName = new Map(nodes.map((node) => [node.name, node]));
  return { nodes, links: links.map((link) => ({ ...link, sourcePoint: byName.get(link.source)!.point, targetPoint: byName.get(link.target)!.point })) };
}
