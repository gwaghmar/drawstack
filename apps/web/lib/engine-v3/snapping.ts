export type SnapRect = { id: string; x: number; y: number; width: number; height: number };
export type SnapGuide = { axis: "x" | "y"; position: number; sourceId: string; edge: "start" | "center" | "end" };
export type SnapResult = { x: number; y: number; guides: SnapGuide[] };

const anchors = (rect: SnapRect, axis: "x" | "y"): Array<{ position: number; edge: SnapGuide["edge"] }> => axis === "x"
  ? [{ position: rect.x, edge: "start" }, { position: rect.x + rect.width / 2, edge: "center" }, { position: rect.x + rect.width, edge: "end" }]
  : [{ position: rect.y, edge: "start" }, { position: rect.y + rect.height / 2, edge: "center" }, { position: rect.y + rect.height, edge: "end" }];

export function buildSnapGuides(rects: readonly SnapRect[], excludedIds: ReadonlySet<string> = new Set()): SnapGuide[] {
  return rects.filter((rect) => !excludedIds.has(rect.id)).flatMap((rect) => (["x", "y"] as const).flatMap((axis) => anchors(rect, axis).map(({ position, edge }) => ({ axis, position, sourceId: rect.id, edge }))));
}

export function snapRect(rect: SnapRect, guides: readonly SnapGuide[], threshold = 6): SnapResult {
  const result = { x: rect.x, y: rect.y, guides: [] as SnapGuide[] };
  for (const axis of ["x", "y"] as const) {
    const size = axis === "x" ? rect.width : rect.height;
    const current = axis === "x" ? rect.x : rect.y;
    const matches = anchors({ ...rect, x: 0, y: 0 }, axis).map(({ position, edge }) => ({ anchor: position, edge }));
    let best: { distance: number; guide: SnapGuide; value: number } | null = null;
    for (const match of matches) for (const guide of guides) {
      if (guide.axis !== axis) continue;
      const value = guide.position - match.anchor;
      const distance = Math.abs(value - current);
      if (distance > threshold || (best && (distance > best.distance || (distance === best.distance && guide.sourceId > best.guide.sourceId)))) continue;
      best = { distance, guide, value };
    }
    if (best) { if (axis === "x") result.x = best.value; else result.y = best.value; result.guides.push(best.guide); }
    void size;
  }
  return result;
}

export function canvasAccessibilityLabel(name: string, nodeCount: number, pageName?: string): string {
  const page = pageName ? ` on page ${pageName}` : "";
  return `${name}${page}, editable canvas with ${nodeCount} visual ${nodeCount === 1 ? "element" : "elements"}. Use the layer tree to select an element.`;
}
