import type { EngineDocumentV3 } from "./document.ts";
import { EngineV3CollaborationController, type CollaborationState } from "./collaboration-controller.ts";
import type { EngineV3CommandEnvelope } from "./commands.ts";

export type EngineV3Transport = {
  publish: (envelope: EngineV3CommandEnvelope) => Promise<void>;
  subscribe: (onEnvelope: (envelope: EngineV3CommandEnvelope) => void) => () => void;
};

export class EngineV3CollaborationSession {
  readonly controller: EngineV3CollaborationController;
  private readonly transport: EngineV3Transport;
  private pendingIds = new Set<string>();
  private unsubscribe: (() => void) | null = null;
  constructor(document: EngineDocumentV3, transport: EngineV3Transport, revision = 0) { this.controller = new EngineV3CollaborationController(document, revision); this.transport = transport; }
  connect(): void { if (this.unsubscribe) return; this.unsubscribe = this.transport.subscribe((envelope) => { this.controller.applyRemote(envelope); }); }
  disconnect(): void { this.unsubscribe?.(); this.unsubscribe = null; }
  async submit(command: Parameters<EngineV3CollaborationController["submit"]>[0], actor: string): Promise<CollaborationState> {
    const state = this.controller.submit(command, actor);
    const envelope = state.pending.at(-1);
    if (envelope) { this.pendingIds.add(envelope.id); await this.transport.publish(envelope); }
    return state;
  }
  acknowledge(id: string, revision?: number): CollaborationState { this.pendingIds.delete(id); return this.controller.acknowledge(id, revision); }
  snapshot(): CollaborationState { return this.controller.snapshot(); }
}
