import type { EngineDocumentV3 } from "./document.ts";
import { applyEngineV3Command, type CommandOrigin, type EngineV3Command, type EngineV3CommandEnvelope } from "./commands.ts";
import { reconcileRemoteCommand, type ReconciliationConflict } from "./reconciliation.ts";

export type CollaborationState = { document: EngineDocumentV3; revision: number; pending: EngineV3CommandEnvelope[]; conflicts: ReconciliationConflict[] };

export class EngineV3CollaborationController {
  private document: EngineDocumentV3;
  private revision: number;
  private pending: EngineV3CommandEnvelope[] = [];
  private conflicts: ReconciliationConflict[] = [];
  constructor(document: EngineDocumentV3, revision = 0) { this.document = structuredClone(document); this.revision = revision; }
  snapshot(): CollaborationState { return { document: structuredClone(this.document), revision: this.revision, pending: structuredClone(this.pending), conflicts: structuredClone(this.conflicts) }; }
  submit(command: EngineV3Command, actor: string, origin: CommandOrigin = "local", id = crypto.randomUUID(), timestamp = new Date().toISOString()): CollaborationState {
    const envelope: EngineV3CommandEnvelope = { id, baseRevision: this.revision, actor, origin, timestamp, command };
    const result = applyEngineV3Command(this.document, this.revision, envelope);
    if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
    this.document = result.document; this.revision = result.revision; this.pending.push(envelope);
    return this.snapshot();
  }
  acknowledge(id: string, serverRevision?: number): CollaborationState {
    this.pending = this.pending.filter((envelope) => envelope.id !== id);
    if (serverRevision !== undefined && serverRevision >= this.revision) this.revision = serverRevision;
    return this.snapshot();
  }
  applyRemote(envelope: EngineV3CommandEnvelope): CollaborationState {
    const own = this.pending.find((pending) => pending.id === envelope.id);
    if (own) return this.acknowledge(envelope.id, envelope.baseRevision + 1);
    const result = reconcileRemoteCommand(this.document, this.revision, envelope, this.pending);
    if (result.kind === "conflict") this.conflicts.push(result);
    else { this.document = result.result.document; this.revision = result.result.revision; }
    return this.snapshot();
  }
  clearConflict(index: number): CollaborationState { this.conflicts.splice(index, 1); return this.snapshot(); }
}
