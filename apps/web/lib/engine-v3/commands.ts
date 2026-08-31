import type { AssetRef, ComponentDefinition, EngineDocumentV3, EngineNode, Page, TokenSet } from "./document.ts";
import { validateEngineV3Document } from "./compiler.ts";
import { duplicateEngineV3Subtree, groupEngineV3Nodes, reorderEngineV3Node, ungroupEngineV3Node } from "./node-operations.ts";

export type CommandOrigin = "local" | "ai" | "import" | "undo" | "redo";
export type CommandPrecondition = { exists?: boolean; type?: EngineNode["type"]; revision?: number };
export type EngineV3Command =
  | { kind: "batch"; commands: EngineV3Command[] }
  | { kind: "page"; action: "add" | "remove" | "rename" | "patch"; page: Page | { id: string; name?: string; width?: number; height?: number | "auto"; background?: string }; index?: number; precondition?: CommandPrecondition }
  | { kind: "tokens"; tokens: TokenSet; precondition?: CommandPrecondition }
  | { kind: "asset"; action: "define" | "remove"; asset: AssetRef | { sha256: string }; precondition?: CommandPrecondition }
  | { kind: "component"; action: "define" | "remove"; component: ComponentDefinition | { id: string }; precondition?: CommandPrecondition }
  | { kind: "node"; action: "add" | "patch" | "remove" | "reorder" | "duplicate" | "group" | "ungroup"; pageId: string; node?: EngineNode; nodeId?: string; nodeIds?: string[]; frame?: Extract<EngineNode, { type: "frame" }>; parentId?: string | null; index?: number; toIndex?: number; changes?: Record<string, unknown>; unset?: string[]; precondition?: CommandPrecondition };
export type EngineV3CommandEnvelope = { id: string; baseRevision: number; actor: string; origin: CommandOrigin; timestamp: string; command: EngineV3Command };
export type CommandFailure = { ok: false; code: "revision-conflict" | "missing-page" | "missing-target" | "precondition-failed" | "invalid-command"; message: string; affectedIds: string[] };
export type CommandSuccess = { ok: true; document: EngineDocumentV3; revision: number; inverse: EngineV3CommandEnvelope; affectedIds: string[] };
export type ApplyCommandResult = CommandSuccess | CommandFailure;

const copy = <T>(value: T): T => structuredClone(value);
function insertAt<T>(items: T[], value: T, index?: number): T[] { const next = [...items]; next.splice(index === undefined ? next.length : Math.max(0, Math.min(index, next.length)), 0, value); return next; }
function locate(root: EngineNode, id: string, parentId: string | null = null, index = 0): { parentId: string | null; index: number } | null {
  if (root.id === id) return { parentId, index };
  if (root.type !== "frame") return null;
  for (let i = 0; i < root.children.length; i += 1) { const found = locate(root.children[i], id, root.id, i); if (found) return found; }
  return null;
}
function findNode(page: Page, id: string): EngineNode | null {
  const visit = (node: EngineNode): EngineNode | null => node.id === id ? node : node.type === "frame" ? node.children.map(visit).find(Boolean) ?? null : null;
  return visit(page.root);
}
function lockedPath(page: Page, id: string): EngineNode[] | null {
  const visit = (node: EngineNode, path: EngineNode[]): EngineNode[] | null => {
    const next = [...path, node];
    if (node.id === id) return next;
    if (node.type === "frame") for (const child of node.children) { const found = visit(child, next); if (found) return found; }
    return null;
  };
  return visit(page.root, []);
}
function assertNodeEditable(page: Page, id: string, allowSelfUnlock = false): void {
  const path = lockedPath(page, id);
  if (!path) return;
  const blocker = path.find((node, index) => node.locked && !(allowSelfUnlock && index === path.length - 1));
  if (blocker) throw new Error(`Node is locked: ${blocker.id}`);
}
function mapNode(node: EngineNode, id: string, update: (node: EngineNode) => EngineNode | null): EngineNode | null {
  if (node.id === id) return update(node);
  if (node.type !== "frame") return node;
  const children = node.children.map((child) => mapNode(child, id, update)).filter((child): child is EngineNode => child !== null);
  return children.length === node.children.length && children.every((child, index) => child === node.children[index]) ? node : { ...node, children };
}
function replacePageNode(page: Page, id: string, update: (node: EngineNode) => EngineNode | null): Page {
  const root = mapNode(page.root, id, update);
  if (!root || root.type !== "frame") throw new Error("Cannot remove page root");
  return root === page.root ? page : { ...page, root };
}
function check(pre: CommandPrecondition | undefined, target: EngineNode | null, revision: number, id: string): CommandFailure | null {
  if (pre?.revision !== undefined && pre.revision !== revision) return { ok: false, code: "precondition-failed", message: "Target revision precondition failed", affectedIds: [id] };
  if (pre?.exists === true && !target) return { ok: false, code: "missing-target", message: "Target does not exist", affectedIds: [id] };
  if (pre?.exists === false && target) return { ok: false, code: "precondition-failed", message: "Target already exists", affectedIds: [id] };
  if (pre?.type && target?.type !== pre.type) return { ok: false, code: "precondition-failed", message: "Target type precondition failed", affectedIds: [id] };
  return null;
}

export function applyEngineV3Command(document: EngineDocumentV3, revision: number, envelope: EngineV3CommandEnvelope): ApplyCommandResult {
  if (envelope.baseRevision !== revision) return { ok: false, code: "revision-conflict", message: "Command is based on an older revision", affectedIds: [] };
  const command = envelope.command;
  let next = copy(document);
  const affectedIds: string[] = [];
  let inverse: EngineV3Command;
  try {
    if (command.kind === "batch") {
      let working = next;
      const inverses: EngineV3Command[] = [];
      const ids: string[] = [];
      for (const [index, child] of command.commands.entries()) {
        const result = applyEngineV3Command(working, revision + index, { ...envelope, id: `${envelope.id}:${index}`, baseRevision: revision + index, command: child });
        if (!result.ok) return result;
        working = result.document;
        inverses.unshift(result.inverse.command);
        ids.push(...result.affectedIds);
      }
      next = working;
      affectedIds.push(...ids);
      inverse = { kind: "batch", commands: inverses };
    } else if (command.kind === "page") {
      const id = command.page.id;
      const index = next.pages.findIndex((page) => page.id === id);
      const failure = check(command.precondition, index >= 0 ? next.pages[index].root : null, revision, id);
      if (failure) return failure;
      if (command.action === "add") { if (index >= 0 || !("width" in command.page)) throw new Error("Invalid page"); next.pages.splice(command.index === undefined ? next.pages.length : Math.max(0, Math.min(command.index, next.pages.length)), 0, copy(command.page as Page)); inverse = { kind: "page", action: "remove", page: { id } }; }
      else if (command.action === "remove") { if (index < 0) throw new Error("Missing page"); const removed = next.pages.splice(index, 1)[0]; inverse = { kind: "page", action: "add", page: removed, index }; }
      else if (command.action === "rename") { if (index < 0 || !command.page.name) throw new Error("Missing page"); const old = next.pages[index].name; next.pages[index] = { ...next.pages[index], name: command.page.name }; inverse = { kind: "page", action: "rename", page: { id, name: old } }; }
      else { if (index < 0) throw new Error("Missing page"); const old = next.pages[index]; const patch = command.page; if (patch.width !== undefined && (!Number.isFinite(patch.width) || patch.width < 240 || patch.width > 5000)) throw new Error("Page width must be between 240 and 5000"); if (patch.height !== undefined && patch.height !== "auto" && (!Number.isFinite(patch.height) || patch.height < 240 || patch.height > 5000)) throw new Error("Page height must be between 240 and 5000"); next.pages[index] = { ...old, ...(patch.width === undefined ? {} : { width: patch.width }), ...(patch.height === undefined ? {} : { height: patch.height }), ...(patch.background === undefined ? {} : { background: patch.background }) }; inverse = { kind: "page", action: "patch", page: { id, ...(patch.width === undefined ? {} : { width: old.width }), ...(patch.height === undefined ? {} : { height: old.height }), ...(patch.background === undefined ? {} : { background: old.background }) } }; }
      affectedIds.push(id);
    } else if (command.kind === "tokens") {
      const old = next.tokens; next.tokens = copy(command.tokens); inverse = { kind: "tokens", tokens: old }; affectedIds.push("tokens");
    } else if (command.kind === "asset") {
      const id = command.asset.sha256;
      const old = next.assets[id];
      if (command.precondition?.revision !== undefined && command.precondition.revision !== revision) return { ok: false, code: "precondition-failed", message: "Asset revision precondition failed", affectedIds: [id] };
      if (command.precondition?.exists === true && !old) return { ok: false, code: "missing-target", message: "Asset does not exist", affectedIds: [id] };
      if (command.precondition?.exists === false && old) return { ok: false, code: "precondition-failed", message: "Asset already exists", affectedIds: [id] };
      if (command.action === "define") { if (old || !("mime" in command.asset)) throw new Error("Invalid asset"); next.assets[id] = copy(command.asset as AssetRef); inverse = { kind: "asset", action: "remove", asset: { sha256: id } }; }
      else { if (!old) throw new Error("Missing asset"); delete next.assets[id]; inverse = { kind: "asset", action: "define", asset: old }; }
      affectedIds.push(id);
    } else if (command.kind === "component") {
      const id = command.component.id; const old = next.components[id]; const failure = check(command.precondition, old?.root ?? null, revision, id); if (failure) return failure;
      if (command.action === "define") { if (old) throw new Error("Component exists"); next.components[id] = copy(command.component as ComponentDefinition); inverse = { kind: "component", action: "remove", component: { id } }; }
      else { if (!old) throw new Error("Missing component"); delete next.components[id]; inverse = { kind: "component", action: "define", component: old }; }
      affectedIds.push(id);
    } else if (command.kind === "node" && ["reorder", "duplicate", "group", "ungroup"].includes(command.action)) {
      const page = next.pages.find((item) => item.id === command.pageId); if (!page) return { ok: false, code: "missing-page", message: "Page does not exist", affectedIds: [command.pageId] };
      if (command.action === "reorder") {
        if (!command.nodeId || command.toIndex === undefined) throw new Error("Invalid reorder");
        const location = locate(page.root, command.nodeId); if (!location) throw new Error("Missing node");
        next = reorderEngineV3Node(next, page.id, command.nodeId, command.toIndex);
        inverse = { kind: "node", action: "reorder", pageId: page.id, nodeId: command.nodeId, toIndex: location.index };
      } else if (command.action === "duplicate") {
        if (!command.nodeId) throw new Error("Invalid duplicate");
        const location = locate(page.root, command.nodeId); if (!location || location.parentId === null) throw new Error("Missing node");
        next = duplicateEngineV3Subtree(next, page.id, command.nodeId);
        const nextPage = next.pages.find((item) => item.id === page.id)!;
        const parent = findNode(nextPage, location.parentId);
        if (!parent || parent.type !== "frame") throw new Error("Missing duplicate parent");
        const duplicate = parent.children[location.index + 1]; if (!duplicate) throw new Error("Missing duplicate");
        inverse = { kind: "node", action: "remove", pageId: page.id, nodeId: duplicate.id };
        affectedIds.push(duplicate.id);
      } else if (command.action === "group") {
        if (!command.nodeIds || !command.frame) throw new Error("Invalid group");
        next = groupEngineV3Nodes(next, page.id, command.nodeIds, command.frame);
        inverse = { kind: "node", action: "ungroup", pageId: page.id, nodeId: command.frame.id };
      } else {
        if (!command.nodeId) throw new Error("Invalid ungroup");
        const frame = findNode(page, command.nodeId); if (!frame || frame.type !== "frame") throw new Error("Missing frame");
        const childIds = frame.children.map((child) => child.id);
        next = ungroupEngineV3Node(next, page.id, command.nodeId);
        inverse = { kind: "node", action: "group", pageId: page.id, nodeIds: childIds, frame };
      }
      affectedIds.push(...(command.nodeIds ?? [command.nodeId ?? page.id]));
    } else {
      const page = next.pages.find((item) => item.id === command.pageId); if (!page) return { ok: false, code: "missing-page", message: "Page does not exist", affectedIds: [command.pageId] };
      const id = command.nodeId ?? command.node?.id ?? ""; const target = findNode(page, id); const failure = check(command.precondition, target, revision, id); if (failure) return failure;
      if (command.action === "add") { if (!command.node || target) throw new Error("Invalid node"); const parentId = command.parentId ?? null; assertNodeEditable(page, parentId ?? page.root.id); next.pages = next.pages.map((item) => { if (item.id !== page.id) return item; return parentId === null ? { ...item, root: { ...item.root, children: insertAt(item.root.children, copy(command.node!), command.index) } } : replacePageNode(item, parentId, (parent) => parent.type === "frame" ? { ...parent, children: insertAt(parent.children, copy(command.node!), command.index) } : parent); }); inverse = { kind: "node", action: "remove", pageId: page.id, nodeId: id, parentId, index: command.index }; }
      else if (command.action === "remove") { if (!target) throw new Error("Missing node"); assertNodeEditable(page, id); const location = locate(page.root, id); if (!location) throw new Error("Missing node"); next.pages = next.pages.map((item) => item.id === page.id ? replacePageNode(item, id, () => null) : item); inverse = { kind: "node", action: "add", pageId: page.id, node: target, parentId: location.parentId, index: location.index }; }
      else { if (!target || !command.changes) throw new Error("Invalid node"); assertNodeEditable(page, id, command.changes.locked === false); const old = copy(target); next.pages = next.pages.map((item) => item.id === page.id ? replacePageNode(item, id, (node) => { const patched = { ...node, ...copy(command.changes) } as Record<string, unknown>; for (const key of command.unset ?? []) delete patched[key]; return patched as EngineNode; }) : item); const previousKeys = new Set(Object.keys(old)); inverse = { kind: "node", action: "patch", pageId: page.id, nodeId: id, changes: old as unknown as Record<string, unknown>, unset: Object.keys(command.changes).filter((key) => !previousKeys.has(key)) }; }
      affectedIds.push(id);
    }
  } catch (error) { return { ok: false, code: "invalid-command", message: error instanceof Error ? error.message : "Invalid command", affectedIds }; }
  const checked = validateEngineV3Document(next);
  if (!checked.ok) return { ok: false, code: "invalid-command", message: `${checked.issues[0]?.path}: ${checked.issues[0]?.message}`, affectedIds };
  return { ok: true, document: checked.document, revision: revision + 1, inverse: { ...envelope, id: envelope.id + ":inverse", baseRevision: revision + 1, command: inverse! }, affectedIds };
}
