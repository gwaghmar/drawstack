import type { EngineDocumentV3, EngineNode } from "./document.ts";
import { applyEngineV3Command, type EngineV3Command, type EngineV3CommandEnvelope } from "./commands.ts";
import { parseEngineV3CommandEnvelope } from "./collaboration-envelope.ts";

export type EngineV3AgentDiagnostic = {
  path: string;
  reason: string;
  candidates: string[];
  suggestion: string;
};

export type EngineV3AgentProposal = {
  envelope: EngineV3CommandEnvelope;
  preview: EngineDocumentV3;
  affectedIds: string[];
  explanation: string;
};

export type EngineV3AgentProposalResult =
  | { ok: true; proposal: EngineV3AgentProposal }
  | { ok: false; diagnostics: EngineV3AgentDiagnostic[] };

const SAFE_PATCH_KEYS = new Set(["name", "content", "alt", "style", "transform", "opacity", "visible"]);
const SAFE_STYLE_KEYS = new Set(["background", "color", "borderColor", "borderWidth", "borderRadius", "minHeight", "width", "flex", "alignSelf", "position", "x", "y", "opacity"]);

function nodes(document: EngineDocumentV3): Map<string, EngineNode> {
  const result = new Map<string, EngineNode>();
  const visit = (node: EngineNode) => {
    result.set(node.id, node);
    if (node.type === "frame") node.children.forEach(visit);
  };
  document.pages.forEach((page) => visit(page.root));
  return result;
}

function commands(command: EngineV3Command): EngineV3Command[] {
  return command.kind === "batch" ? command.commands.flatMap(commands) : [command];
}

function diagnostic(path: string, reason: string, candidates: string[], suggestion: string): EngineV3AgentDiagnostic {
  return { path, reason, candidates, suggestion };
}

function validSafeStyle(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!SAFE_STYLE_KEYS.has(key)) return false;
    if (["background", "color", "borderColor"].includes(key) && (typeof entry !== "string" || entry.length > 120 || /url\s*\(/i.test(entry))) return false;
    if (["alignSelf", "position"].includes(key) && typeof entry !== "string") return false;
    if (!["background", "color", "borderColor", "alignSelf", "position", "width"].includes(key) && (typeof entry !== "number" || !Number.isFinite(entry))) return false;
    if (key === "width" && typeof entry !== "number" && (typeof entry !== "string" || !/^(?:100|[1-9]?\d)%$/.test(entry))) return false;
  }
  return true;
}

export function createEngineV3AgentReadView(document: EngineDocumentV3, selectedNodeIds: string[]) {
  const byId = nodes(document);
  const pageByNode = new Map<string, string>();
  for (const page of document.pages) for (const id of nodes({ ...document, pages: [page] }).keys()) pageByNode.set(id, page.id);
  const selected = selectedNodeIds.flatMap((id) => {
    const node = byId.get(id);
    return node ? [{ pageId: pageByNode.get(id), node }] : [];
  });
  return {
    document: { id: document.metadata.id, name: document.metadata.name, version: document.version },
    pages: document.pages.map((page) => ({ id: page.id, name: page.name, width: page.width, height: page.height, rootId: page.root.id })),
    selected,
    availableNodeIds: [...byId.keys()],
  };
}

export function parseEngineV3AgentProposal(
  source: unknown,
  document: EngineDocumentV3,
  revision: number,
  selectedNodeIds: string[],
  safeMode: boolean,
  actor = "engine-v3-agent",
): EngineV3AgentProposalResult {
  if (!source || typeof source !== "object" || Array.isArray(source)) return { ok: false, diagnostics: [diagnostic("$", "Expected a proposal object", [], "Return one JSON object with commands and explanation.")] };
  const value = source as Record<string, unknown>;
  if (!Array.isArray(value.commands) || value.commands.length === 0) return { ok: false, diagnostics: [diagnostic("commands", "Expected at least one command", [], "Return a non-empty commands array.")] };
  const envelope = parseEngineV3CommandEnvelope({ id: crypto.randomUUID(), baseRevision: revision, actor, origin: "ai", timestamp: new Date().toISOString(), command: { kind: "batch", commands: value.commands } });
  if (!envelope) return { ok: false, diagnostics: [diagnostic("commands", "The proposal contains a malformed command", [], "Use only the documented command shapes and existing IDs.")] };
  const proposedCommands = commands(envelope.command);
  if (proposedCommands.length > 50) return { ok: false, diagnostics: [diagnostic("commands", "A proposal may contain at most 50 commands", [], "Split the request into smaller changes.")] };
  const assetIndex = proposedCommands.findIndex((command) => command.kind === "asset");
  if (assetIndex >= 0) return { ok: false, diagnostics: [diagnostic(`commands[${assetIndex}]`, "AI proposals cannot define or remove assets", [], "Use the authenticated asset uploader instead.")] };
  if (safeMode) {
    const selected = new Set(selectedNodeIds);
    const available = [...nodes(document).keys()];
    for (const [index, command] of commands(envelope.command).entries()) {
      if (command.kind !== "node" || command.action !== "patch" || !command.nodeId || !selected.has(command.nodeId)) {
        return { ok: false, diagnostics: [diagnostic(`commands[${index}]`, "Safe mode may only patch selected existing nodes", selectedNodeIds, "Select the target and return a node patch for that ID.")] };
      }
      const invalid = Object.keys(command.changes ?? {}).filter((key) => !SAFE_PATCH_KEYS.has(key));
      if (invalid.length || command.unset?.some((key) => !SAFE_PATCH_KEYS.has(key))) {
        return { ok: false, diagnostics: [diagnostic(`commands[${index}].changes`, `Safe mode cannot change ${invalid.join(", ") || "that field"}`, [...SAFE_PATCH_KEYS], "Limit the patch to visible presentation or content fields.")] };
      }
      if (command.changes?.style !== undefined && !validSafeStyle(command.changes.style)) return { ok: false, diagnostics: [diagnostic(`commands[${index}].changes.style`, "Safe mode received an unsupported style value", [...SAFE_STYLE_KEYS], "Use bounded visual style fields without URLs.")] };
      if (!available.includes(command.nodeId)) return { ok: false, diagnostics: [diagnostic(`commands[${index}].nodeId`, "Target does not exist", available, "Choose one of the available node IDs.")] };
    }
  }
  const applied = applyEngineV3Command(document, revision, envelope);
  if (!applied.ok) return { ok: false, diagnostics: [diagnostic("commands", applied.message, applied.affectedIds, "Repair the command against the current revision and existing IDs.")] };
  return { ok: true, proposal: { envelope, preview: applied.document, affectedIds: applied.affectedIds, explanation: typeof value.explanation === "string" ? value.explanation.slice(0, 800) : "AI proposed a document change." } };
}

export function parseEngineV3AgentModelText(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(trimmed); } catch {
    const start = trimmed.indexOf("{"); const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { return null; }
  }
}
