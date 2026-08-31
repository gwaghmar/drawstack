import type { EngineDocumentV3, EngineNode } from "./document.ts";
import { findEngineV3Node, patchEngineV3Node } from "./node-operations.ts";
import { buildSnapGuides, snapRect, type SnapGuide, type SnapRect } from "./snapping.ts";

export type GestureResult = { document: EngineDocumentV3; guides: SnapGuide[] };

export function engineV3NodeParentOffset(document: EngineDocumentV3, pageId: string, nodeId: string): { x: number; y: number } {
  const location = findEngineV3Node(document, pageId, nodeId);
  if (!location) return { x: 0, y: 0 };
  return location.ancestorIds.reduce((offset, ancestorId) => {
    const ancestor = findEngineV3Node(document, pageId, ancestorId)?.node;
    return { x: offset.x + (ancestor?.transform?.x ?? 0), y: offset.y + (ancestor?.transform?.y ?? 0) };
  }, { x: 0, y: 0 });
}

function rects(document: EngineDocumentV3, pageId: string, excludedIds: ReadonlySet<string>): SnapRect[] {
  const page = document.pages.find((item) => item.id === pageId); if (!page) return [];
  const result: SnapRect[] = [];
  const visit = (nodes: typeof page.root.children, x = 0, y = 0) => nodes.forEach((node) => { const transform = node.transform ?? {}; const style = node.style ?? {}; const width = typeof style.width === "number" ? style.width : 0; const height = typeof style.minHeight === "number" ? style.minHeight : 0; result.push({ id: node.id, x: x + (transform.x ?? 0), y: y + (transform.y ?? 0), width, height }); if (node.type === "frame") visit(node.children, x + (transform.x ?? 0), y + (transform.y ?? 0)); });
  visit([page.root]); return result.filter((item) => !excludedIds.has(item.id));
}

function subtreeIds(node: EngineNode): Set<string> {
  const ids = new Set<string>();
  const visit = (current: EngineNode) => { ids.add(current.id); if (current.type === "frame") current.children.forEach(visit); };
  visit(node); return ids;
}

export function dragEngineV3Node(document: EngineDocumentV3, pageId: string, nodeId: string, x: number, y: number): GestureResult {
  const location = findEngineV3Node(document, pageId, nodeId); if (!location) throw new Error(`Node not found: ${nodeId}`);
  const node = location.node; const width = typeof node.style?.width === "number" ? node.style.width : 0; const height = typeof node.style?.minHeight === "number" ? node.style.minHeight : 0;
  const snapped = snapRect({ id: nodeId, x, y, width, height }, buildSnapGuides(rects(document, pageId, subtreeIds(node))));
  const parent = engineV3NodeParentOffset(document, pageId, nodeId);
  return { document: patchEngineV3Node(document, pageId, nodeId, { transform: { ...(node.transform ?? {}), x: snapped.x - parent.x, y: snapped.y - parent.y } }), guides: snapped.guides };
}

export function resizeEngineV3Node(document: EngineDocumentV3, pageId: string, nodeId: string, width: number, height?: number): GestureResult {
  const location = findEngineV3Node(document, pageId, nodeId); if (!location) throw new Error(`Node not found: ${nodeId}`);
  return { document: patchEngineV3Node(document, pageId, nodeId, { style: { ...(location.node.style ?? {}), width: Math.max(1, width), ...(height === undefined ? {} : { minHeight: Math.max(1, height) }) } }), guides: [] };
}
