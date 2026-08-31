import type { EngineFrameNode, EngineNode } from "./document.ts";

export type EngineNodeLocation = {
  node: EngineNode;
  parent: EngineFrameNode | null;
  parentId: string | null;
  index: number;
};

export type DuplicateNodeResult = {
  nodes: EngineNode[];
  duplicatedId: string;
};

export type DuplicateNodesResult = {
  nodes: EngineNode[];
  duplicatedIds: string[];
};

export type PasteNodesResult = {
  nodes: EngineNode[];
  pastedIds: string[];
};

export function findParent(nodes: EngineNode[], id: string): EngineNodeLocation | null {
  const visit = (children: EngineNode[], parent: EngineFrameNode | null): EngineNodeLocation | null => {
    for (let index = 0; index < children.length; index += 1) {
      const node = children[index];
      if (node.id === id) {
        return { node, parent, parentId: parent?.id ?? null, index };
      }
      if (node.type === "frame") {
        const nested = visit(node.children, node);
        if (nested) return nested;
      }
    }
    return null;
  };
  return visit(nodes, null);
}

function updateChildrenAtParent(
  nodes: EngineNode[],
  parentId: string | null,
  update: (children: EngineNode[]) => EngineNode[],
): EngineNode[] {
  if (parentId === null) return update(nodes);
  const parent = findParent(nodes, parentId)?.node;
  if (!parent) throw new Error(`Parent node ${parentId} was not found`);
  if (parent.type !== "frame") throw new Error(`Node ${parentId} cannot contain children`);
  return updateChildrenAtParentIfPresent(nodes, parentId, update);
}

function updateChildrenAtParentIfPresent(
  nodes: EngineNode[],
  parentId: string,
  update: (children: EngineNode[]) => EngineNode[],
): EngineNode[] {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.id === parentId) {
      if (node.type !== "frame") throw new Error(`Node ${parentId} cannot contain children`);
      const children = update(node.children);
      if (children === node.children) return nodes;
      const next = [...nodes];
      next[index] = { ...node, children };
      return next;
    }
    if (node.type === "frame") {
      const children = updateChildrenAtParentIfPresent(node.children, parentId, update);
      if (children !== node.children) {
        const next = [...nodes];
        next[index] = { ...node, children };
        return next;
      }
    }
  }
  return nodes;
}

function boundedIndex(index: number | undefined, length: number): number {
  if (index === undefined) return length;
  return Math.max(0, Math.min(Math.trunc(index), length));
}

export function insertNode(
  nodes: EngineNode[],
  node: EngineNode,
  parentId: string | null = null,
  index?: number,
): EngineNode[] {
  return updateChildrenAtParent(nodes, parentId, (children) => {
    const next = [...children];
    next.splice(boundedIndex(index, children.length), 0, node);
    return next;
  });
}

export function removeNode(nodes: EngineNode[], id: string): EngineNode[] {
  const location = findParent(nodes, id);
  if (!location || location.node.locked) return nodes;
  return updateChildrenAtParent(nodes, location.parentId, (children) => children.filter((node) => node.id !== id));
}

export function replaceNode(nodes: EngineNode[], id: string, replacement: EngineNode): EngineNode[] {
  const location = findParent(nodes, id);
  if (!location || location.node.locked) return nodes;
  return updateChildrenAtParent(nodes, location.parentId, (children) => {
    const next = [...children];
    next[location.index] = replacement;
    return next;
  });
}

export function reorderNode(nodes: EngineNode[], id: string, toIndex: number): EngineNode[] {
  const location = findParent(nodes, id);
  if (!location || location.node.locked) return nodes;
  return updateChildrenAtParent(nodes, location.parentId, (children) => {
    const target = Math.max(0, Math.min(Math.trunc(toIndex), children.length - 1));
    if (target === location.index) return children;
    const next = [...children];
    const [node] = next.splice(location.index, 1);
    next.splice(target, 0, node);
    return next;
  });
}

export function moveNode(nodes: EngineNode[], id: string, direction: "up" | "down"): EngineNode[] {
  const location = findParent(nodes, id);
  if (!location) return nodes;
  return reorderNode(nodes, id, location.index + (direction === "up" ? -1 : 1));
}

export function moveNodeUp(nodes: EngineNode[], id: string): EngineNode[] {
  return moveNode(nodes, id, "up");
}

export function moveNodeDown(nodes: EngineNode[], id: string): EngineNode[] {
  return moveNode(nodes, id, "down");
}

function containsNode(node: EngineNode, id: string): boolean {
  if (node.id === id) return true;
  return node.type === "frame" && node.children.some((child) => containsNode(child, id));
}

export function moveNodeToParent(
  nodes: EngineNode[],
  id: string,
  parentId: string | null,
  insertionIndex?: number,
): EngineNode[] {
  const source = findParent(nodes, id);
  if (!source || source.node.locked || id === parentId) return nodes;
  const destination = parentId === null ? null : findParent(nodes, parentId)?.node;
  if (parentId !== null && (!destination || destination.type !== "frame" || destination.locked)) return nodes;
  if (source.node.type === "frame" && parentId !== null && containsNode(source.node, parentId)) return nodes;

  const destinationChildren = destination?.type === "frame" ? destination.children : nodes;
  let target = boundedIndex(insertionIndex, destinationChildren.length);
  if (source.parentId === parentId && source.index < target) target -= 1;
  if (source.parentId === parentId && source.index === target) return nodes;

  const withoutSource = removeNode(nodes, id);
  return insertNode(withoutSource, source.node, parentId, target);
}

export function moveNodeByArrow(
  nodes: EngineNode[],
  id: string,
  direction: "up" | "down" | "left" | "right",
): EngineNode[] {
  const location = findParent(nodes, id);
  if (!location) return nodes;
  if (direction === "up" || direction === "down") return moveNode(nodes, id, direction);

  if (direction === "right") {
    const siblings = location.parent?.children ?? nodes;
    const previous = siblings[location.index - 1];
    if (!previous || previous.type !== "frame") return nodes;
    return moveNodeToParent(nodes, id, previous.id, previous.children.length);
  }

  if (!location.parent) return nodes;
  const parentLocation = findParent(nodes, location.parent.id)!;
  return moveNodeToParent(nodes, id, parentLocation.parentId, parentLocation.index + 1);
}

function collectIds(nodes: EngineNode[], ids = new Set<string>()): Set<string> {
  for (const node of nodes) {
    ids.add(node.id);
    if (node.type === "frame") collectIds(node.children, ids);
  }
  return ids;
}

export function uniqueNodeId(nodes: EngineNode[], base: string): string {
  const usedIds = collectIds(nodes);
  if (!usedIds.has(base)) return base;
  let suffix = 2;
  while (usedIds.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function copyId(id: string, usedIds: Set<string>): string {
  let candidate = `${id}-copy`;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${id}-copy-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function cloneWithNewIds(node: EngineNode, usedIds: Set<string>, isRoot: boolean): EngineNode {
  const id = copyId(node.id, usedIds);
  const name = isRoot ? `${node.name} copy` : node.name;
  if (node.type !== "frame") return { ...node, id, name };
  return {
    ...node,
    id,
    name,
    children: node.children.map((child) => cloneWithNewIds(child, usedIds, false)),
  };
}

export function duplicateNode(nodes: EngineNode[], id: string): DuplicateNodeResult {
  const location = findParent(nodes, id);
  if (!location || location.node.locked) return { nodes, duplicatedId: id };
  const duplicate = cloneWithNewIds(location.node, collectIds(nodes), true);
  return {
    nodes: insertNode(nodes, duplicate, location.parentId, location.index + 1),
    duplicatedId: duplicate.id,
  };
}

function selectedRoots(nodes: EngineNode[], ids: ReadonlySet<string>): string[] {
  const roots: string[] = [];
  const visit = (items: EngineNode[], ancestorSelected: boolean) => {
    for (const node of items) {
      const selected = ids.has(node.id);
      if (selected && !ancestorSelected) roots.push(node.id);
      if (node.type === "frame") visit(node.children, ancestorSelected || selected);
    }
  };
  visit(nodes, false);
  return roots;
}

export function duplicateNodes(nodes: EngineNode[], ids: Iterable<string>): DuplicateNodesResult {
  const selected = new Set(ids);
  const roots = selectedRoots(nodes, selected);
  let next = nodes;
  const duplicatedIds: string[] = [];
  for (const id of roots) {
    const result = duplicateNode(next, id);
    if (result.nodes !== next) duplicatedIds.push(result.duplicatedId);
    next = result.nodes;
  }
  return { nodes: next, duplicatedIds };
}

export function copyNodes(nodes: EngineNode[], ids: Iterable<string>): EngineNode[] {
  const roots = selectedRoots(nodes, new Set(ids));
  return roots.map((id) => structuredClone(findParent(nodes, id)!.node));
}

export function pasteNodes(
  nodes: EngineNode[],
  clipboardNodes: EngineNode[],
  parentId: string | null,
  insertionIndex?: number,
): PasteNodesResult {
  if (!clipboardNodes.length) return { nodes, pastedIds: [] };
  const parent = parentId === null ? null : findParent(nodes, parentId)?.node;
  if (parentId !== null && (parent?.type !== "frame" || parent.locked)) return { nodes, pastedIds: [] };
  const usedIds = collectIds(nodes);
  let next = nodes;
  const pastedIds: string[] = [];
  let index = boundedIndex(insertionIndex, parent?.type === "frame" ? parent.children.length : nodes.length);
  for (const clipboardNode of clipboardNodes) {
    const clone = cloneWithNewIds(structuredClone(clipboardNode), usedIds, false);
    next = insertNode(next, clone, parentId, index);
    pastedIds.push(clone.id);
    index += 1;
  }
  return { nodes: next, pastedIds };
}

export function removeNodes(nodes: EngineNode[], ids: Iterable<string>): EngineNode[] {
  const selected = new Set(ids);
  const roots = new Set(selectedRoots(nodes, selected));
  if (!roots.size) return nodes;
  if (nodes.every((node) => roots.has(node.id))) return nodes;

  const remove = (items: EngineNode[]): EngineNode[] => {
    let changed = false;
    const next: EngineNode[] = [];
    for (const node of items) {
      if (roots.has(node.id) && !node.locked) {
        changed = true;
        continue;
      }
      if (node.type === "frame") {
        const children = remove(node.children);
        if (children !== node.children) {
          next.push({ ...node, children });
          changed = true;
          continue;
        }
      }
      next.push(node);
    }
    return changed ? next : items;
  };
  return remove(nodes);
}

function sharedFrameParent(nodes: EngineNode[], ids: string[]): EngineFrameNode | null {
  if (ids.length < 2) return null;
  const locations = ids.map((id) => findParent(nodes, id));
  if (locations.some((location) => !location)) return null;
  const parentId = locations[0]!.parentId;
  if (parentId === null || locations.some((location) => location!.parentId !== parentId)) return null;
  const parent = findParent(nodes, parentId)?.node;
  return parent?.type === "frame" ? parent : null;
}

export function alignNodes(
  nodes: EngineNode[],
  ids: string[],
  alignment: "start" | "center" | "end" | "stretch",
): EngineNode[] {
  if (!sharedFrameParent(nodes, ids) || ids.some((id) => findParent(nodes, id)?.node.locked)) return nodes;
  const selected = new Set(ids);
  const alignSelf = alignment === "start" ? "flex-start" : alignment === "end" ? "flex-end" : alignment;
  const update = (items: EngineNode[]): EngineNode[] => items.map((node) => {
    if (selected.has(node.id)) return { ...node, style: { ...node.style, alignSelf } };
    if (node.type !== "frame") return node;
    const children = update(node.children);
    return children.some((child, index) => child !== node.children[index]) ? { ...node, children } : node;
  });
  return update(nodes);
}

export function distributeNodes(
  nodes: EngineNode[],
  ids: string[],
  distribution: "packed" | "between" | "around" | "evenly",
): EngineNode[] {
  const parent = sharedFrameParent(nodes, ids);
  if (!parent) return nodes;
  const justify = distribution === "packed" ? "flex-start" : `space-${distribution}` as "space-between" | "space-around" | "space-evenly";
  return replaceNode(nodes, parent.id, { ...parent, layout: { ...parent.layout, justify } });
}
