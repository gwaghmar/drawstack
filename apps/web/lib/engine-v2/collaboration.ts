import type { EngineDocumentOperation, EngineDocumentTransaction } from "./transactions";

export type EngineEditCursor = { createdAt: string; id: string };

export type EngineTransactionEnvelope = {
  transaction: EngineDocumentTransaction;
  clientId: string;
  baseCursor: EngineEditCursor;
};

export type EngineTransactionRecord = EngineTransactionEnvelope & {
  cursor: EngineEditCursor;
  userId: string;
};

export type EngineTransactionConflict = {
  leftTransactionId: string;
  rightTransactionId: string;
  keys: string[];
};

const OPERATION_TYPES = new Set([
  "set-name",
  "set-artboard",
  "set-tokens",
  "put-node",
  "patch-node",
  "remove-node",
  "set-child-order",
]);
const TRANSACTION_ORIGINS = new Set(["local", "ai", "import", "restore", "undo", "redo"]);

export function compareEngineEditCursors(left: EngineEditCursor, right: EngineEditCursor) {
  const dateOrder = left.createdAt.localeCompare(right.createdAt);
  return dateOrder || left.id.localeCompare(right.id);
}

function isCursor(value: unknown): value is EngineEditCursor {
  if (!value || typeof value !== "object") return false;
  const cursor = value as Partial<EngineEditCursor>;
  return typeof cursor.createdAt === "string"
    && !Number.isNaN(new Date(cursor.createdAt).getTime())
    && typeof cursor.id === "string";
}

function isOperation(value: unknown): value is EngineDocumentOperation {
  if (!value || typeof value !== "object") return false;
  const operation = value as Record<string, unknown>;
  if (typeof operation.type !== "string" || !OPERATION_TYPES.has(operation.type)) return false;
  switch (operation.type) {
    case "set-name":
      return typeof operation.name === "string";
    case "set-artboard":
      return Boolean(operation.artboard && typeof operation.artboard === "object");
    case "set-tokens":
      return Boolean(operation.tokens && typeof operation.tokens === "object");
    case "put-node": {
      const node = operation.node as Record<string, unknown> | undefined;
      return Boolean(node && typeof node.id === "string" && typeof node.name === "string" && typeof node.type === "string" && !("children" in node));
    }
    case "patch-node":
      return typeof operation.nodeId === "string"
        && Boolean(operation.changes && typeof operation.changes === "object" && !Array.isArray(operation.changes))
        && Array.isArray(operation.unset)
        && operation.unset.every((key) => typeof key === "string");
    case "remove-node":
      return typeof operation.nodeId === "string";
    case "set-child-order":
      return (operation.parentId === null || typeof operation.parentId === "string")
        && Array.isArray(operation.childIds)
        && operation.childIds.every((id) => typeof id === "string");
    default:
      return false;
  }
}

export function isEngineTransactionEnvelope(value: unknown): value is EngineTransactionEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<EngineTransactionEnvelope>;
  const transaction = envelope.transaction as Partial<EngineDocumentTransaction> | undefined;
  return typeof envelope.clientId === "string"
    && envelope.clientId.length > 0
    && envelope.clientId.length <= 120
    && isCursor(envelope.baseCursor)
    && Boolean(transaction)
    && typeof transaction?.id === "string"
    && transaction.id.length > 0
    && transaction.id.length <= 120
    && typeof transaction.origin === "string"
    && TRANSACTION_ORIGINS.has(transaction.origin)
    && Array.isArray(transaction.operations)
    && transaction.operations.length > 0
    && transaction.operations.length <= 500
    && transaction.operations.every(isOperation);
}

export function engineTransactionKeys(transaction: EngineDocumentTransaction) {
  const keys = new Set<string>();
  for (const operation of transaction.operations) {
    switch (operation.type) {
      case "set-name":
        keys.add("document:name");
        break;
      case "set-artboard":
        keys.add("document:artboard");
        break;
      case "set-tokens":
        keys.add("document:tokens");
        break;
      case "put-node":
      case "remove-node":
        keys.add(`node:${operation.type === "put-node" ? operation.node.id : operation.nodeId}:*`);
        break;
      case "patch-node":
        for (const key of [...Object.keys(operation.changes), ...operation.unset]) keys.add(`node:${operation.nodeId}:${key}`);
        break;
      case "set-child-order":
        keys.add(`children:${operation.parentId ?? "root"}`);
        break;
    }
  }
  return keys;
}

function keysOverlap(left: string, right: string) {
  if (left === right) return true;
  const leftParts = left.split(":");
  const rightParts = right.split(":");
  return leftParts[0] === "node"
    && rightParts[0] === "node"
    && leftParts[1] === rightParts[1]
    && (leftParts[2] === "*" || rightParts[2] === "*");
}

export function findEngineTransactionConflict(
  left: EngineTransactionRecord,
  right: EngineTransactionRecord,
): EngineTransactionConflict | null {
  if (left.clientId === right.clientId) return null;
  const leftSawRight = compareEngineEditCursors(left.baseCursor, right.cursor) >= 0;
  const rightSawLeft = compareEngineEditCursors(right.baseCursor, left.cursor) >= 0;
  if (leftSawRight || rightSawLeft) return null;
  const rightKeys = engineTransactionKeys(right.transaction);
  const keys = [...engineTransactionKeys(left.transaction)].filter((leftKey) => [...rightKeys].some((rightKey) => keysOverlap(leftKey, rightKey)));
  if (!keys.length) return null;
  return {
    leftTransactionId: left.transaction.id,
    rightTransactionId: right.transaction.id,
    keys,
  };
}

export function parseEngineTransactionEnvelope(value: string): EngineTransactionEnvelope | null {
  if (value.length > 500_000) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isEngineTransactionEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
