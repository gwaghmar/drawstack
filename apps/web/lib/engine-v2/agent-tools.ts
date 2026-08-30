import { validateEngineV2Document, type EngineV2ValidationIssue } from "./compiler.ts";
import type { EngineDocument, EngineNode } from "./document.ts";
import {
  createEngineV2JsonExport,
  createEngineV2PrintHtmlExport,
  createEngineV2ReactTsxExport,
  createEngineV2SvgExport,
  type EngineV2ExportPayload,
} from "./export.ts";
import { applyEngineDocumentTransaction, type EngineDocumentTransaction } from "./transactions.ts";

export type EngineV2AgentError = {
  ok: false;
  error: string;
  issues?: EngineV2ValidationIssue[];
};

export type EngineV2NodeInspection = {
  id: string;
  name: string;
  type: EngineNode["type"];
  parentId: string | null;
  depth: number;
  childIds: string[];
};

export type EngineV2Inspection = {
  ok: true;
  document: EngineDocument;
  nodes: EngineV2NodeInspection[];
  selectedNode: EngineNode | null;
};

export type EngineV2InspectSelector =
  | { nodeId: string; nodeName?: never }
  | { nodeId?: never; nodeName: string };

export type EngineV2AgentExportFormat = "json" | "svg" | "html" | "tsx";

function invalidDocument(issues: EngineV2ValidationIssue[]): EngineV2AgentError {
  return { ok: false, error: "Invalid Engine v2 document", issues };
}

function nodeIndex(document: EngineDocument): EngineV2NodeInspection[] {
  const result: EngineV2NodeInspection[] = [];
  const visit = (nodes: EngineNode[], parentId: string | null, depth: number) => {
    for (const node of nodes) {
      result.push({
        id: node.id,
        name: node.name,
        type: node.type,
        parentId,
        depth,
        childIds: node.type === "frame" ? node.children.map((child) => child.id) : [],
      });
      if (node.type === "frame") visit(node.children, node.id, depth + 1);
    }
  };
  visit(document.children, null, 0);
  return result;
}

function findSelectedNode(nodes: EngineNode[], selector: EngineV2InspectSelector): EngineNode | null {
  for (const node of nodes) {
    const matches = "nodeId" in selector ? node.id === selector.nodeId : node.name === selector.nodeName;
    if (matches) return node;
    if (node.type === "frame") {
      const nested = findSelectedNode(node.children, selector);
      if (nested) return nested;
    }
  }
  return null;
}

export function inspectEngineV2Document(
  input: unknown,
  selector?: EngineV2InspectSelector,
): EngineV2Inspection | EngineV2AgentError {
  const validated = validateEngineV2Document(input);
  if (!validated.ok) return invalidDocument(validated.issues);
  const selectedNode = selector ? findSelectedNode(validated.document.children, selector) : null;
  if (selector && !selectedNode) {
    const target = "nodeId" in selector ? selector.nodeId : selector.nodeName;
    return { ok: false, error: `Node not found: ${target}` };
  }
  return {
    ok: true,
    document: validated.document,
    nodes: nodeIndex(validated.document),
    selectedNode,
  };
}

export function applyEngineV2AgentTransaction(
  input: unknown,
  transaction: EngineDocumentTransaction,
): { ok: true; document: EngineDocument } | EngineV2AgentError {
  const validated = validateEngineV2Document(input);
  if (!validated.ok) return invalidDocument(validated.issues);
  const applied = applyEngineDocumentTransaction(validated.document, transaction);
  const result = validateEngineV2Document(applied);
  if (!result.ok) {
    return { ok: false, error: "Transaction produced an invalid Engine v2 document", issues: result.issues };
  }
  return { ok: true, document: result.document };
}

export function exportEngineV2Document(
  input: unknown,
  format: EngineV2AgentExportFormat,
): { ok: true; payload: EngineV2ExportPayload } | EngineV2AgentError {
  const validated = validateEngineV2Document(input);
  if (!validated.ok) return invalidDocument(validated.issues);
  const exporters: Record<EngineV2AgentExportFormat, (document: EngineDocument) => EngineV2ExportPayload> = {
    json: createEngineV2JsonExport,
    svg: createEngineV2SvgExport,
    html: createEngineV2PrintHtmlExport,
    tsx: createEngineV2ReactTsxExport,
  };
  return { ok: true, payload: exporters[format](validated.document) };
}
