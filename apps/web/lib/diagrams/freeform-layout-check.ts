import { type CanvasDocument, type CanvasShape, type ArrowShape, type FrameShape, isBoundEndpoint, getShapeBounds } from "./freeform-canvas.ts";

export type LayoutIssue = { kind: string; message: string; shapeIds: string[] };

function overlapArea(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): number {
  const overlapW = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const overlapH = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return overlapW * overlapH;
}

function shapeLabel(shape: CanvasShape): string {
  return shape.name ?? shape.id;
}

export function checkLayoutIssues(doc: CanvasDocument): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const idSet = new Set(doc.shapes.map((s) => s.id));

  const overlapCandidates = doc.shapes.filter(
    (s) => s.type !== "arrow" && s.type !== "line" && s.type !== "path"
  );

  for (let i = 0; i < overlapCandidates.length; i++) {
    for (let j = i + 1; j < overlapCandidates.length; j++) {
      const a = overlapCandidates[i];
      const b = overlapCandidates[j];

      if (a.frameId === b.id || b.frameId === a.id) continue;
      if (a.parentId === b.id || b.parentId === a.id) continue;
      if (a.type === "frame" || b.type === "frame") continue;

      const aBounds = getShapeBounds(doc, a);
      const bBounds = getShapeBounds(doc, b);
      const aArea = aBounds.width * aBounds.height;
      const bArea = bBounds.width * bBounds.height;
      if (aArea <= 0 || bArea <= 0) continue;

      const smallerArea = Math.min(aArea, bArea);
      const overlap = overlapArea(aBounds, bBounds);
      if (overlap <= 0) continue;

      const ratio = overlap / smallerArea;
      if (ratio > 0.3) {
        issues.push({
          kind: "overlap",
          message: `Shape '${shapeLabel(a)}' and '${shapeLabel(b)}' overlap by ~${Math.round(ratio * 100)}% — they likely need repositioning or aren't meant to overlap.`,
          shapeIds: [a.id, b.id],
        });
      }
    }
  }

  for (const shape of doc.shapes) {
    if (shape.type !== "arrow" && shape.type !== "line") continue;
    const arrow = shape as ArrowShape;

    if (isBoundEndpoint(arrow.start) && !idSet.has(arrow.start.shapeId)) {
      issues.push({
        kind: "dangling-arrow-ref",
        message: `Arrow '${shapeLabel(arrow)}' start references missing shape "${arrow.start.shapeId}" — fix or remove this arrow.`,
        shapeIds: [arrow.id],
      });
    }
    if (isBoundEndpoint(arrow.end) && !idSet.has(arrow.end.shapeId)) {
      issues.push({
        kind: "dangling-arrow-ref",
        message: `Arrow '${shapeLabel(arrow)}' end references missing shape "${arrow.end.shapeId}" — fix or remove this arrow.`,
        shapeIds: [arrow.id],
      });
    }
  }

  for (const shape of doc.shapes) {
    if (!shape.frameId) continue;
    const frame = doc.shapes.find((s) => s.id === shape.frameId && s.type === "frame") as FrameShape | undefined;
    if (!frame) continue;

    const shapeBounds = getShapeBounds(doc, shape);
    // Use the frame's own authored rect, not getShapeBounds(frame) — the frame's
    // dynamic bounds auto-grow to wrap every child under it, which would make an
    // out-of-bounds child undetectable by definition.
    const frameBounds = { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
    const shapeArea = shapeBounds.width * shapeBounds.height;
    if (shapeArea <= 0) continue;

    const inside = overlapArea(shapeBounds, frameBounds);
    const insideRatio = inside / shapeArea;
    if (insideRatio < 0.5) {
      issues.push({
        kind: "outside-frame",
        message: `Shape '${shapeLabel(shape)}' is positioned mostly outside its parent frame '${shapeLabel(frame)}' — move it inside the frame's bounds.`,
        shapeIds: [shape.id, frame.id],
      });
    }
  }

  return issues;
}
