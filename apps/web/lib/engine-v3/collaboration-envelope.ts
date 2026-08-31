import type { EngineV3CommandEnvelope } from "./commands.ts";

const origins = new Set(["local", "ai", "import", "undo", "redo"]);
const safeId = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;

export function parseEngineV3CommandEnvelope(source: unknown): EngineV3CommandEnvelope | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const value = source as Record<string, unknown>;
  if (!safeId.test(String(value.id)) || !safeId.test(String(value.actor)) || typeof value.timestamp !== "string" || Number.isNaN(Date.parse(value.timestamp as string)) || !Number.isInteger(value.baseRevision) || (value.baseRevision as number) < 0 || !origins.has(String(value.origin)) || !value.command || typeof value.command !== "object") return null;
  const command = value.command as Record<string, unknown>;
  if (!parseCommand(command)) return null;
  return value as unknown as EngineV3CommandEnvelope;
}

function parseCommand(command: Record<string, unknown>): boolean {
  if (command.kind === "batch") return Array.isArray(command.commands) && command.commands.length > 0 && command.commands.every((item) => item && typeof item === "object" && parseCommand(item as Record<string, unknown>));
  if (command.kind === "tokens") return Boolean(command.tokens && typeof command.tokens === "object");
  if (command.kind === "page") return ["add", "remove", "rename"].includes(String(command.action)) && Boolean(command.page && typeof command.page === "object");
  if (command.kind === "asset") return ["define", "remove"].includes(String(command.action)) && Boolean(command.asset && typeof command.asset === "object") && typeof (command.asset as Record<string, unknown>).sha256 === "string";
  if (command.kind === "component") return ["define", "remove"].includes(String(command.action)) && Boolean(command.component && typeof command.component === "object");
  if (command.kind === "node") {
    if (typeof command.pageId !== "string") return false;
    if (command.action === "add") return Boolean(command.node && typeof command.node === "object");
    if (["patch", "remove", "duplicate", "ungroup"].includes(String(command.action))) return typeof command.nodeId === "string";
    if (command.action === "reorder") return typeof command.nodeId === "string" && Number.isInteger(command.toIndex);
    if (command.action === "group") return Array.isArray(command.nodeIds) && command.nodeIds.length > 1 && command.nodeIds.every((id) => typeof id === "string") && Boolean(command.frame && typeof command.frame === "object");
    return false;
  }
  return false;
}
