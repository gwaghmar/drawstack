import { validateEngineV2Document } from "./compiler.ts";
import type { EngineDocument } from "./document.ts";
import {
  applyEngineDocumentTransaction,
  createEngineDocumentTransaction,
  type EngineDocumentTransaction,
  type EngineTransactionOrigin,
} from "./transactions.ts";

export type EngineProposalState = "draft" | "approved" | "rejected" | "committed";

export type EngineTransactionChangeSummary = {
  operationCount: number;
  addedNodeIds: string[];
  removedNodeIds: string[];
  changedNodeIds: string[];
  changedRoots: string[];
  fields: string[];
};

export type EngineTransactionProposal = {
  proposalId: string;
  state: EngineProposalState;
  baseFingerprint: string;
  forwardDocument: EngineDocument;
  inverseDocument: EngineDocument;
  transaction: EngineDocumentTransaction;
  summary: EngineTransactionChangeSummary;
  issues: string[];
};

export type EngineProposalResult =
  | { ok: true; proposal: EngineTransactionProposal }
  | { ok: false; issues: string[] };

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

export function fingerprintEngineDocument(document: EngineDocument): string {
  let hash = 2166136261;
  for (const char of stable(document)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function summary(transaction: EngineDocumentTransaction): EngineTransactionChangeSummary {
  const added: string[] = [], removed: string[] = [], changed: string[] = [], fields = new Set<string>();
  for (const operation of transaction.operations) {
    if (operation.type === "put-node") added.push(operation.node.id);
    if (operation.type === "remove-node") removed.push(operation.nodeId);
    if (operation.type === "patch-node") {
      changed.push(operation.nodeId);
      Object.keys(operation.changes).forEach((field) => fields.add(field));
      operation.unset.forEach((field) => fields.add(field));
    }
    if (operation.type === "set-child-order") fields.add("child-order");
    if (operation.type === "set-name") fields.add("name");
    if (operation.type === "set-artboard") fields.add("artboard");
    if (operation.type === "set-tokens") fields.add("tokens");
  }
  return { operationCount: transaction.operations.length, addedNodeIds: added.sort(), removedNodeIds: removed.sort(), changedNodeIds: changed.sort(), changedRoots: [...new Set([...added, ...removed, ...changed])].sort(), fields: [...fields].sort() };
}

export function createEngineTransactionProposal(
  base: EngineDocument,
  forward: EngineDocument,
  origin: EngineTransactionOrigin,
  proposalId: string,
): EngineProposalResult {
  const baseCheck = validateEngineV2Document(base);
  const forwardCheck = validateEngineV2Document(forward);
  if (!baseCheck.ok || !forwardCheck.ok) return { ok: false, issues: [...(!baseCheck.ok ? baseCheck.issues.map((issue) => `base: ${issue.path} ${issue.message}`) : []), ...(!forwardCheck.ok ? forwardCheck.issues.map((issue) => `forward: ${issue.path} ${issue.message}`) : [])] };
  const transaction = createEngineDocumentTransaction(baseCheck.document, forwardCheck.document, origin, proposalId);
  return { ok: true, proposal: { proposalId, state: "draft", baseFingerprint: fingerprintEngineDocument(baseCheck.document), forwardDocument: forwardCheck.document, inverseDocument: baseCheck.document, transaction, summary: summary(transaction), issues: [] } };
}

export function approveEngineTransactionProposal(proposal: EngineTransactionProposal): EngineProposalResult {
  if (proposal.state !== "draft") return { ok: false, issues: [`Cannot approve proposal in ${proposal.state} state`] };
  return { ok: true, proposal: { ...proposal, state: "approved" } };
}

export function rejectEngineTransactionProposal(proposal: EngineTransactionProposal, reason = "Rejected by user"): EngineProposalResult {
  if (proposal.state !== "draft" && proposal.state !== "approved") return { ok: false, issues: [`Cannot reject proposal in ${proposal.state} state`] };
  return { ok: true, proposal: { ...proposal, state: "rejected", issues: [...proposal.issues, reason] } };
}

export function commitEngineTransactionProposal(proposal: EngineTransactionProposal, current: EngineDocument): EngineProposalResult {
  if (proposal.state !== "approved") return { ok: false, issues: [`Cannot commit proposal in ${proposal.state} state`] };
  const currentCheck = validateEngineV2Document(current);
  if (!currentCheck.ok) return { ok: false, issues: currentCheck.issues.map((issue) => `${issue.path} ${issue.message}`) };
  if (fingerprintEngineDocument(currentCheck.document) !== proposal.baseFingerprint) return { ok: false, issues: ["Base document changed since proposal was created"] };
  const applied = applyEngineDocumentTransaction(currentCheck.document, proposal.transaction);
  const check = validateEngineV2Document(applied);
  if (!check.ok) return { ok: false, issues: check.issues.map((issue) => `${issue.path} ${issue.message}`) };
  return { ok: true, proposal: { ...proposal, state: "committed", forwardDocument: check.document } };
}
