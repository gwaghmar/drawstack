import type { EngineDocument, EngineNode } from "./document.ts";
import { findNode, mapNode } from "./document.ts";
import { applyEngineDocumentTransaction, createEngineDocumentTransaction, type EngineDocumentTransaction } from "./transactions.ts";

export type EngineAiScope = "create" | "edit";

export type EngineAiChangeSummary = {
  scope: EngineAiScope;
  selectedNodeIds: string[];
  changedNodeIds: string[];
  operationCount: number;
  transactionId: string;
};

function collectNodes(nodes: EngineNode[], result = new Map<string, EngineNode>()) {
  for (const node of nodes) {
    result.set(node.id, node);
    if (node.type === "frame") collectNodes(node.children, result);
  }
  return result;
}

export function applyAiScope(
  current: EngineDocument | null,
  generated: EngineDocument,
  scope: EngineAiScope,
  selectedNodeIds: string[],
): { document: EngineDocument; transaction: EngineDocumentTransaction; summary: EngineAiChangeSummary } {
  if (scope === "create" || !current) {
    const transaction = createEngineDocumentTransaction(current ?? generated, generated, "ai");
    return { document: generated, transaction, summary: { scope, selectedNodeIds, changedNodeIds: [...collectNodes(generated.children).keys()], operationCount: transaction.operations.length, transactionId: transaction.id } };
  }

  const generatedNodes = collectNodes(generated.children);
  const selected = [...new Set(selectedNodeIds)];
  const missingCurrent = selected.filter((id) => !findNode(current.children, id));
  if (missingCurrent.length) throw new Error(`Selected node ids were not found: ${missingCurrent.join(", ")}`);
  const missing = selected.filter((id) => !generatedNodes.has(id));
  if (missing.length) throw new Error(`The AI response did not include selected node ids: ${missing.join(", ")}`);
  let scoped = current;
  for (const id of selected) {
    const replacement = generatedNodes.get(id);
    if (!replacement) continue;
    scoped = { ...scoped, children: mapNode(scoped.children, id, () => replacement) };
  }
  const transaction = createEngineDocumentTransaction(current, scoped, "ai");
  return { document: applyEngineDocumentTransaction(current, transaction), transaction, summary: { scope, selectedNodeIds: selected, changedNodeIds: selected, operationCount: transaction.operations.length, transactionId: transaction.id } };
}
