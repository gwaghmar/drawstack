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
  if (!location) return nodes;
  return updateChildrenAtParent(nodes, location.parentId, (children) => children.filter((node) => node.id !== id));
}

export function replaceNode(nodes: EngineNode[], id: string, replacement: EngineNode): EngineNode[] {
  const location = findParent(nodes, id);
  if (!location) return nodes;
  return updateChildrenAtParent(nodes, location.parentId, (children) => {
    const next = [...children];
    next[location.index] = replacement;
    return next;
  });
}

export function reorderNode(nodes: EngineNode[], id: string, toIndex: number): EngineNode[] {
  const location = findParent(nodes, id);
  if (!location) return nodes;
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

function collectIds(nodes: EngineNode[], ids = new Set<string>()): Set<string> {
  for (const node of nodes) {
    ids.add(node.id);
    if (node.type === "frame") collectIds(node.children, ids);
  }
  return ids;
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
  if (!location) return { nodes, duplicatedId: id };
  const duplicate = cloneWithNewIds(location.node, collectIds(nodes), true);
  return {
    nodes: insertNode(nodes, duplicate, location.parentId, location.index + 1),
    duplicatedId: duplicate.id,
  };
}
