import type { EngineDocumentV3 } from "./document.ts";
import { applyEngineV3Command, type EngineV3Command, type EngineV3CommandEnvelope, type ApplyCommandResult } from "./commands.ts";

export type ReconciliationConflict = { kind: "conflict"; reason: "stale-base" | "overlapping-target"; affectedIds: string[]; incoming: EngineV3CommandEnvelope };
export type ReconciliationResult = { kind: "applied"; result: ApplyCommandResult & { ok: true } } | ReconciliationConflict;

export function commandAffectedIds(command: EngineV3Command): string[] {
  if (command.kind === "batch") return [...new Set(command.commands.flatMap(commandAffectedIds))];
  if (command.kind === "tokens") return ["tokens"];
  if (command.kind === "page") return [command.page.id];
  if (command.kind === "component") return [command.component.id];
  if (command.kind === "asset") return [command.asset.sha256];
  const ids = [command.nodeId ?? command.node?.id ?? ""];
  if (command.action === "add" && command.parentId) ids.push(command.parentId);
  return ids.filter(Boolean);
}

export function reconcileRemoteCommand(document: EngineDocumentV3, revision: number, incoming: EngineV3CommandEnvelope, pendingLocal: readonly EngineV3CommandEnvelope[] = []): ReconciliationResult {
  const incomingIds = new Set(commandAffectedIds(incoming.command));
  if (incoming.baseRevision < revision) {
    const overlap = pendingLocal.flatMap((pending) => commandAffectedIds(pending.command)).filter((id) => incomingIds.has(id));
    if (overlap.length) return { kind: "conflict", reason: "overlapping-target", affectedIds: [...new Set(overlap)], incoming };
    const rebased = { ...incoming, baseRevision: revision };
    const result = applyEngineV3Command(document, revision, rebased);
    return result.ok ? { kind: "applied", result } : { kind: "conflict", reason: "stale-base", affectedIds: result.affectedIds.length ? result.affectedIds : [...incomingIds], incoming };
  }
  if (incoming.baseRevision > revision) return { kind: "conflict", reason: "stale-base", affectedIds: [...incomingIds], incoming };
  const result = applyEngineV3Command(document, revision, incoming);
  return result.ok ? { kind: "applied", result } : { kind: "conflict", reason: "stale-base", affectedIds: result.affectedIds, incoming };
}
