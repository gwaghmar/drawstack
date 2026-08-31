import type { EngineDocumentV3, EngineFrameNode, EngineNode, Page } from "./document.ts";

export type NodeLocation = { pageId: string; node: EngineNode; parentId: string | null; index: number; ancestorIds: string[] };
const clone = <T>(value: T): T => structuredClone(value);

function locate(page: Page, id: string, nodes: EngineNode[] = page.root.children, parentId: string | null = page.root.id, ancestorIds: string[] = [page.root.id]): NodeLocation | null {
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (node.id === id) return { pageId: page.id, node, parentId, index, ancestorIds };
    if (node.type === "frame") {
      const found = locate(page, id, node.children, node.id, [...ancestorIds, node.id]);
      if (found) return found;
    }
  }
  return page.root.id === id ? { pageId: page.id, node: page.root, parentId: null, index: -1, ancestorIds: [] } : null;
}

export function findEngineV3Node(document: EngineDocumentV3, pageId: string, nodeId: string): NodeLocation | null {
  const page = document.pages.find((candidate) => candidate.id === pageId);
  return page ? locate(page, nodeId) : null;
}

function assertEditable(location: NodeLocation, page: Page, allowSelfUnlock = false) {
  if (location.node.locked && !allowSelfUnlock) throw new Error(`Node is locked: ${location.node.id}`);
  for (const id of location.ancestorIds) if (locate(page, id)?.node.locked) throw new Error(`Ancestor is locked: ${id}`);
}

function documentHasNodeId(document: EngineDocumentV3, nodeId: string): boolean {
  return document.pages.some((page) => locate(page, nodeId) !== null);
}

function updateChildren(page: Page, parentId: string | null, update: (children: EngineNode[]) => EngineNode[]): Page {
  if (parentId === null || parentId === page.root.id) return { ...page, root: { ...page.root, children: update(page.root.children) } };
  const visit = (nodes: EngineNode[]): EngineNode[] => nodes.map((node) => node.id === parentId && node.type === "frame" ? { ...node, children: update(node.children) } : node.type === "frame" ? { ...node, children: visit(node.children) } : node);
  return { ...page, root: { ...page.root, children: visit(page.root.children) } };
}

export function patchEngineV3Node(document: EngineDocumentV3, pageId: string, nodeId: string, changes: Partial<EngineNode>): EngineDocumentV3 {
  const page = document.pages.find((candidate) => candidate.id === pageId); const location = findEngineV3Node(document, pageId, nodeId);
  if (!page || !location) throw new Error(`Node not found: ${nodeId}`); assertEditable(location, page, changes.locked === false);
  if (changes.id !== undefined && changes.id !== nodeId) throw new Error("Node identity cannot change");
  if (changes.type !== undefined && changes.type !== location.node.type) throw new Error("Node type cannot change");
  if (location.parentId === null) {
    const root = { ...page.root, ...clone(changes), id: page.root.id, type: "frame" as const } as EngineFrameNode;
    return { ...document, pages: document.pages.map((candidate) => candidate.id === pageId ? { ...page, root } : candidate) };
  }
  const next = updateChildren(page, location.parentId, (children) => children.map((node) => node.id === nodeId ? { ...node, ...clone(changes), id: node.id, type: node.type } as EngineNode : node));
  return { ...document, pages: document.pages.map((candidate) => candidate.id === pageId ? next : candidate) };
}

export function insertEngineV3Node(document: EngineDocumentV3, pageId: string, parentId: string | null, node: EngineNode, index = Number.MAX_SAFE_INTEGER): EngineDocumentV3 {
  const page = document.pages.find((candidate) => candidate.id === pageId); if (!page) throw new Error(`Page not found: ${pageId}`);
  const parent = parentId ? findEngineV3Node(document, pageId, parentId) : null;
  if (parentId && (!parent || parent.node.type !== "frame")) throw new Error(`Parent frame not found: ${parentId}`);
  if (parent) assertEditable(parent, page);
  else if (page.root.locked) throw new Error(`Node is locked: ${page.root.id}`);
  if (documentHasNodeId(document, node.id)) throw new Error(`Duplicate node id: ${node.id}`);
  const next = updateChildren(page, parentId, (children) => { const result = [...children]; result.splice(Math.max(0, Math.min(index, result.length)), 0, clone(node)); return result; });
  return { ...document, pages: document.pages.map((candidate) => candidate.id === pageId ? next : candidate) };
}

export function removeEngineV3Node(document: EngineDocumentV3, pageId: string, nodeId: string): { document: EngineDocumentV3; removed: NodeLocation } {
  const page = document.pages.find((candidate) => candidate.id === pageId); const location = findEngineV3Node(document, pageId, nodeId);
  if (!page || !location || location.parentId === null) throw new Error(`Cannot remove node: ${nodeId}`); assertEditable(location, page);
  const next = updateChildren(page, location.parentId, (children) => children.filter((node) => node.id !== nodeId));
  return { document: { ...document, pages: document.pages.map((candidate) => candidate.id === pageId ? next : candidate) }, removed: { ...location, node: clone(location.node) } };
}

export function reorderEngineV3Node(document: EngineDocumentV3, pageId: string, nodeId: string, toIndex: number): EngineDocumentV3 {
  const page = document.pages.find((candidate) => candidate.id === pageId); const location = findEngineV3Node(document, pageId, nodeId); if (!page || !location || location.parentId === null) throw new Error(`Node not found: ${nodeId}`); assertEditable(location, page);
  const next = updateChildren(page, location.parentId, (children) => { const result = [...children]; const [node] = result.splice(location.index, 1); result.splice(Math.max(0, Math.min(toIndex, result.length)), 0, node); return result; });
  return { ...document, pages: document.pages.map((candidate) => candidate.id === pageId ? next : candidate) };
}

export function duplicateEngineV3Subtree(document: EngineDocumentV3, pageId: string, nodeId: string, idPrefix = "copy"): EngineDocumentV3 {
  const location = findEngineV3Node(document, pageId, nodeId); const page = document.pages.find((candidate) => candidate.id === pageId); if (!page || !location || location.parentId === null) throw new Error(`Node not found: ${nodeId}`); assertEditable(location, page);
  const used = new Set<string>(); const collect = (node: EngineNode) => { used.add(node.id); if (node.type === "frame") node.children.forEach(collect); }; document.pages.forEach((candidate) => collect(candidate.root));
  let serial = 1; const remap = (node: EngineNode): EngineNode => { let id = `${idPrefix}-${serial++}`; while (used.has(id)) id = `${idPrefix}-${serial++}`; used.add(id); const next = clone(node); return next.type === "frame" ? { ...next, id, children: next.children.map(remap) } : { ...next, id }; };
  return insertEngineV3Node(document, pageId, location.parentId, remap(location.node), location.index + 1);
}

export function groupEngineV3Nodes(document: EngineDocumentV3, pageId: string, nodeIds: string[], frame: EngineFrameNode): EngineDocumentV3 {
  if (nodeIds.length < 2 || new Set(nodeIds).size !== nodeIds.length) throw new Error("Select at least two unique nodes");
  const locations = nodeIds.map((id) => findEngineV3Node(document, pageId, id)); if (locations.some((value) => !value)) throw new Error("Node not found");
  const first = locations[0]!; if (locations.some((value) => value!.parentId !== first.parentId)) throw new Error("Nodes must share a parent");
  const page = document.pages.find((candidate) => candidate.id === pageId)!;
  locations.forEach((location) => assertEditable(location!, page));
  if (documentHasNodeId(document, frame.id)) throw new Error(`Duplicate node id: ${frame.id}`);
  const selected = new Set(nodeIds);
  const next = updateChildren(page, first.parentId, (children) => {
    const ordered = children.filter((node) => selected.has(node.id));
    const remaining = children.filter((node) => !selected.has(node.id));
    remaining.splice(Math.min(...locations.map((location) => location!.index)), 0, { ...clone(frame), children: ordered });
    return remaining;
  });
  return { ...document, pages: document.pages.map((candidate) => candidate.id === pageId ? next : candidate) };
}

export function ungroupEngineV3Node(document: EngineDocumentV3, pageId: string, frameId: string): EngineDocumentV3 {
  const location = findEngineV3Node(document, pageId, frameId); const page = document.pages.find((candidate) => candidate.id === pageId); if (!page || !location || location.node.type !== "frame" || location.parentId === null) throw new Error(`Frame not found: ${frameId}`); assertEditable(location, page);
  const frame = location.node;
  const next = updateChildren(page, location.parentId, (children) => { const result = [...children]; result.splice(location.index, 1, ...frame.children); return result; }); return { ...document, pages: document.pages.map((candidate) => candidate.id === pageId ? next : candidate) };
}
