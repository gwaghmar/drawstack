import type { EngineNode } from "./document.ts";

export function groupNodes(nodes: EngineNode[], ids: readonly string[], groupId: string, name = "Group"): EngineNode[] {
  if (ids.length < 2 || new Set(ids).size !== ids.length) return nodes;
  const containsId = (items: EngineNode[]): boolean => items.some((node) => node.id === groupId || (node.type === "frame" && containsId(node.children)));
  if (containsId(nodes)) return nodes;
  const selected = new Set(ids);
  const visit = (items: EngineNode[]): EngineNode[] => {
    const indexes = items.map((node, index) => selected.has(node.id) ? index : -1).filter((index) => index >= 0);
    if (indexes.length === ids.length) {
      const ordered = items.filter((node) => selected.has(node.id));
      if (ordered.length !== ids.length || ordered.some((node) => node.locked)) return items;
      const children = items.filter((node) => !selected.has(node.id));
      children.splice(indexes[0], 0, { id: groupId, name, type: "frame", layout: { mode: "flex", direction: "row", gap: 0, padding: 0 }, children: ordered });
      return children;
    }
    let changed = false;
    const next = items.map((node) => {
      if (node.type !== "frame") return node;
      const children = visit(node.children);
      if (children === node.children) return node;
      changed = true;
      return { ...node, children };
    });
    return changed ? next : items;
  };
  return visit(nodes);
}

export function ungroupNode(nodes: EngineNode[], groupId: string): EngineNode[] {
  const visit = (items: EngineNode[]): EngineNode[] => {
    const index = items.findIndex((node) => node.id === groupId);
    if (index >= 0) {
      const group = items[index];
      if (group.type !== "frame" || group.locked) return items;
      return [...items.slice(0, index), ...group.children, ...items.slice(index + 1)];
    }
    let changed = false;
    const next = items.map((node) => {
      if (node.type !== "frame") return node;
      const children = visit(node.children);
      if (children === node.children) return node;
      changed = true;
      return { ...node, children };
    });
    return changed ? next : items;
  };
  return visit(nodes);
}
