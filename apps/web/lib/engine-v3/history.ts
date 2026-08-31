import type { EngineDocumentV3 } from "./document.ts";
import { applyEngineV3Command, type CommandOrigin, type EngineV3Command, type EngineV3CommandEnvelope } from "./commands.ts";

type Entry = { forward: EngineV3Command; inverse: EngineV3Command; actor: string; timestamp: string };
export type EngineV3HistoryState = { document: EngineDocumentV3; revision: number; canUndo: boolean; canRedo: boolean };

export class EngineV3HistoryController {
  private document: EngineDocumentV3;
  private revision: number;
  private past: Entry[] = [];
  private future: Entry[] = [];
  constructor(document: EngineDocumentV3, revision = 0) { this.document = structuredClone(document); this.revision = revision; }
  snapshot(): EngineV3HistoryState { return { document: structuredClone(this.document), revision: this.revision, canUndo: this.past.length > 0, canRedo: this.future.length > 0 }; }
  apply(command: EngineV3Command, origin: CommandOrigin = "local", actor = "local", id = crypto.randomUUID()): EngineV3HistoryState {
    const envelope: EngineV3CommandEnvelope = { id, baseRevision: this.revision, actor, origin, timestamp: new Date().toISOString(), command };
    const result = applyEngineV3Command(this.document, this.revision, envelope);
    if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
    this.document = result.document; this.revision = result.revision;
    if (origin !== "undo" && origin !== "redo") { this.past.push({ forward: command, inverse: result.inverse.command, actor, timestamp: envelope.timestamp }); this.future = []; }
    return this.snapshot();
  }
  undo(actor = "local"): EngineV3HistoryState {
    const entry = this.past.at(-1); if (!entry) return this.snapshot();
    this.apply(entry.inverse, "undo", actor);
    this.past.pop(); this.future.push(entry); return this.snapshot();
  }
  redo(actor = "local"): EngineV3HistoryState {
    const entry = this.future.at(-1); if (!entry) return this.snapshot();
    this.apply(entry.forward, "redo", actor);
    this.future.pop(); this.past.push(entry); return this.snapshot();
  }
}
