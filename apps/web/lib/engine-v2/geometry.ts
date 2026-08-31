export type Rect = { x: number; y: number; width: number; height: number };
export type SnapGuide = { axis: "x" | "y"; value: number; distance: number; sourceId: string };

const edges = (rect: Rect, axis: "x" | "y"): number[] => axis === "x"
  ? [rect.x, rect.x + rect.width / 2, rect.x + rect.width]
  : [rect.y, rect.y + rect.height / 2, rect.y + rect.height];

export function snapRect(rect: Rect, peers: Array<{ id: string; rect: Rect }>, threshold = 6): { rect: Rect; guides: SnapGuide[] } {
  const candidates: Array<SnapGuide & { offset: number }> = [];
  for (const axis of ["x", "y"] as const) {
    for (const peer of peers) for (const value of edges(peer.rect, axis)) for (const current of edges(rect, axis)) {
      const distance = Math.abs(value - current);
      if (distance <= threshold) candidates.push({ axis, value, distance, sourceId: peer.id, offset: value - current });
    }
  }
  const best = (axis: "x" | "y") => candidates
    .filter((guide) => guide.axis === axis)
    .sort((a, b) => a.distance - b.distance || a.value - b.value || a.sourceId.localeCompare(b.sourceId))[0];
  const x = best("x");
  const y = best("y");
  const guides = [x, y].filter((guide): guide is SnapGuide & { offset: number } => Boolean(guide)).map(({ offset: _offset, ...guide }) => guide);
  return { rect: { ...rect, x: x ? rect.x + x.offset : rect.x, y: y ? rect.y + y.offset : rect.y }, guides };
}

export function snapResize(rect: Rect, peers: Array<{ id: string; rect: Rect }>, threshold = 6): { rect: Rect; guides: SnapGuide[] } {
  const result = snapRect({ x: rect.x + rect.width, y: rect.y + rect.height, width: 0, height: 0 }, peers, threshold);
  return { rect: { ...rect, width: Math.max(1, result.rect.x - rect.x), height: Math.max(1, result.rect.y - rect.y) }, guides: result.guides };
}
