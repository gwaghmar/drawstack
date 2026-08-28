import type {
  EngineChartNode,
  EngineDocument,
  EngineFrameNode,
  EngineGraphNode,
  EngineMetricNode,
  EngineNode,
  EngineTextNode,
} from "./document";

export type EngineNodeRecord =
  | EngineTextNode
  | EngineMetricNode
  | EngineChartNode
  | EngineGraphNode
  | Omit<EngineFrameNode, "children">;

export type EngineDocumentOperation =
  | { type: "set-name"; name: string }
  | { type: "set-artboard"; artboard: EngineDocument["artboard"] }
  | { type: "set-tokens"; tokens: EngineDocument["tokens"] }
  | { type: "put-node"; node: EngineNodeRecord }
  | { type: "patch-node"; nodeId: string; changes: Record<string, unknown>; unset: string[] }
  | { type: "remove-node"; nodeId: string }
  | { type: "set-child-order"; parentId: string | null; childIds: string[] };

export type EngineTransactionOrigin = "local" | "ai" | "import" | "restore" | "undo" | "redo";

export type EngineDocumentTransaction = {
  id: string;
  origin: EngineTransactionOrigin;
  operations: EngineDocumentOperation[];
};

type NormalizedDocument = {
  name: string;
  artboard: EngineDocument["artboard"];
  tokens: EngineDocument["tokens"];
  nodes: Map<string, EngineNodeRecord>;
  childOrders: Map<string | null, string[]>;
};

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diffRecord(before: EngineNodeRecord, after: EngineNodeRecord) {
  const previous = before as unknown as Record<string, unknown>;
  const next = after as unknown as Record<string, unknown>;
  const changes: Record<string, unknown> = {};
  const unset: string[] = [];
  for (const [key, value] of Object.entries(next)) {
    if (!same(previous[key], value)) changes[key] = value;
  }
  for (const key of Object.keys(previous)) {
    if (!(key in next)) unset.push(key);
  }
  return { changes, unset };
}

function nodeRecord(node: EngineNode): EngineNodeRecord {
  if (node.type !== "frame") return node;
  const { children: _children, ...record } = node;
  return record;
}

function normalize(document: EngineDocument): NormalizedDocument {
  const nodes = new Map<string, EngineNodeRecord>();
  const childOrders = new Map<string | null, string[]>();

  const visit = (children: EngineNode[], parentId: string | null) => {
    childOrders.set(parentId, children.map((node) => node.id));
    for (const node of children) {
      nodes.set(node.id, nodeRecord(node));
      if (node.type === "frame") visit(node.children, node.id);
    }
  };

  visit(document.children, null);
  return {
    name: document.name,
    artboard: document.artboard,
    tokens: document.tokens,
    nodes,
    childOrders,
  };
}

function materialize(normalized: NormalizedDocument): EngineDocument {
  const visiting = new Set<string>();
  const buildNode = (id: string): EngineNode | null => {
    const record = normalized.nodes.get(id);
    if (!record || visiting.has(id)) return null;
    if (record.type !== "frame") return record;
    visiting.add(id);
    const children = (normalized.childOrders.get(id) ?? [])
      .map(buildNode)
      .filter((node): node is EngineNode => node !== null);
    visiting.delete(id);
    return { ...record, children };
  };

  return {
    version: 2,
    engine: "dom-css",
    name: normalized.name,
    artboard: normalized.artboard,
    tokens: normalized.tokens,
    children: (normalized.childOrders.get(null) ?? [])
      .map(buildNode)
      .filter((node): node is EngineNode => node !== null),
  };
}

export function createEngineDocumentTransaction(
  before: EngineDocument,
  after: EngineDocument,
  origin: EngineTransactionOrigin,
  id = crypto.randomUUID(),
): EngineDocumentTransaction {
  const previous = normalize(before);
  const next = normalize(after);
  const operations: EngineDocumentOperation[] = [];

  if (previous.name !== next.name) operations.push({ type: "set-name", name: next.name });
  if (!same(previous.artboard, next.artboard)) operations.push({ type: "set-artboard", artboard: next.artboard });
  if (!same(previous.tokens, next.tokens)) operations.push({ type: "set-tokens", tokens: next.tokens });

  for (const [nodeId, record] of next.nodes) {
    const previousRecord = previous.nodes.get(nodeId);
    if (!previousRecord || previousRecord.type !== record.type) {
      operations.push({ type: "put-node", node: record });
      continue;
    }
    const patch = diffRecord(previousRecord, record);
    if (Object.keys(patch.changes).length || patch.unset.length) {
      operations.push({ type: "patch-node", nodeId, ...patch });
    }
  }

  for (const nodeId of previous.nodes.keys()) {
    if (!next.nodes.has(nodeId)) operations.push({ type: "remove-node", nodeId });
  }

  for (const [parentId, childIds] of next.childOrders) {
    if (!same(previous.childOrders.get(parentId), childIds)) {
      operations.push({ type: "set-child-order", parentId, childIds });
    }
  }

  return { id, origin, operations };
}

export function applyEngineDocumentTransaction(
  document: EngineDocument,
  transaction: EngineDocumentTransaction,
): EngineDocument {
  const normalized = normalize(document);

  for (const operation of transaction.operations) {
    switch (operation.type) {
      case "set-name":
        normalized.name = operation.name;
        break;
      case "set-artboard":
        normalized.artboard = operation.artboard;
        break;
      case "set-tokens":
        normalized.tokens = operation.tokens;
        break;
      case "put-node":
        normalized.nodes.set(operation.node.id, operation.node);
        if (operation.node.type === "frame" && !normalized.childOrders.has(operation.node.id)) {
          normalized.childOrders.set(operation.node.id, []);
        }
        break;
      case "patch-node": {
        const current = normalized.nodes.get(operation.nodeId);
        if (!current) break;
        const patched = { ...current, ...operation.changes } as EngineNodeRecord;
        for (const key of operation.unset) delete (patched as unknown as Record<string, unknown>)[key];
        normalized.nodes.set(operation.nodeId, patched);
        break;
      }
      case "remove-node":
        normalized.nodes.delete(operation.nodeId);
        normalized.childOrders.delete(operation.nodeId);
        for (const [parentId, childIds] of normalized.childOrders) {
          if (childIds.includes(operation.nodeId)) {
            normalized.childOrders.set(parentId, childIds.filter((id) => id !== operation.nodeId));
          }
        }
        break;
      case "set-child-order":
        normalized.childOrders.set(operation.parentId, [...operation.childIds]);
        break;
    }
  }

  return materialize(normalized);
}
