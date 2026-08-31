import type { EngineDocumentV3, EngineNode, Page, TokenSet } from "./document.ts";
import { validateEngineV3Document } from "./compiler.ts";

export type ResolvedStyle = Record<string, unknown>;
export type ResolvedRenderRecord = {
  id: string;
  pageId: string;
  parentId: string | null;
  type: EngineNode["type"];
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  transform: { x: number; y: number; rotation: number; scaleX: number; scaleY: number };
  style: ResolvedStyle;
  asset?: { id: string; ref: EngineDocumentV3["assets"][string] };
  node: EngineNode;
};

export type ResolvedPagePlan = {
  id: string;
  name: string;
  width: number;
  height: number | "auto";
  background: string;
  records: ResolvedRenderRecord[];
};
export type EngineV3RenderPlan = { pages: ResolvedPagePlan[]; tokens: TokenSet };

function resolveValue(value: unknown, tokens: TokenSet, category?: keyof TokenSet, stack: string[] = []): unknown {
  if (typeof value !== "string" || !value.startsWith("$")) return value;
  const name = value.slice(1);
  const categories = category ? [category] : (Object.keys(tokens) as (keyof TokenSet)[]);
  for (const currentCategory of categories) {
    const map = tokens[currentCategory] as Record<string, { value: unknown; alias?: string; fallback?: unknown }>;
    const token = map[name];
    if (!token) continue;
    if (stack.includes(`${currentCategory}.${name}`)) throw new Error(`Token alias cycle: ${stack.join(" -> ")} -> ${currentCategory}.${name}`);
    if (token.alias) return resolveValue(`$${token.alias}`, tokens, currentCategory, [...stack, `${currentCategory}.${name}`]);
    if (typeof token.value === "string" && token.value.startsWith("$")) {
      try { return resolveValue(token.value, tokens, currentCategory, [...stack, `${currentCategory}.${name}`]); }
      catch (error) { if (token.fallback !== undefined) return token.fallback; throw error; }
    }
    return token.value ?? token.fallback;
  }
  throw new Error(`Unresolved token: ${value}`);
}

function resolveObject(value: unknown, tokens: TokenSet): unknown {
  if (Array.isArray(value)) return value.map((item) => resolveObject(item, tokens));
  if (!value || typeof value !== "object") return resolveValue(value, tokens);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveObject(item, tokens)]));
}

function applyOverrides(node: EngineNode, overrides: Record<string, unknown> | undefined): EngineNode {
  if (!overrides) return node;
  const result = structuredClone(node) as EngineNode;
  for (const [path, value] of Object.entries(overrides)) {
    const keys = path.split(".");
    if (keys.some((key) => !key || key === "__proto__" || key === "prototype" || key === "constructor")) throw new Error(`Unsupported component override path: ${path}`);
    let target = result as unknown as Record<string, unknown>;
    for (const key of keys.slice(0, -1)) {
      if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) throw new Error(`Unsupported component override path: ${path}`);
      target = target[key] as Record<string, unknown>;
    }
    target[keys.at(-1)!] = structuredClone(value);
  }
  return result;
}

function expandedNode(document: EngineDocumentV3, node: EngineNode, stack: string[] = []): EngineNode {
  if (!node.componentRef) return node;
  const definition = document.components[node.componentRef];
  if (!definition) throw new Error(`Unresolved component: ${node.componentRef}`);
  if (stack.includes(node.componentRef)) throw new Error(`Component cycle: ${[...stack, node.componentRef].join(" -> ")}`);
  const instance = applyOverrides(definition.root, node.instanceOverrides);
  return expandedNode(document, {
    ...instance,
    id: node.id,
    name: node.name,
    visible: node.visible ?? instance.visible,
    locked: node.locked ?? instance.locked,
    transform: node.transform ?? instance.transform,
    opacity: node.opacity ?? instance.opacity,
    blendMode: node.blendMode ?? instance.blendMode,
    styleRef: node.styleRef ?? instance.styleRef,
    assetRef: node.assetRef ?? instance.assetRef,
  }, [...stack, node.componentRef]);
}

function pageRecords(document: EngineDocumentV3, page: Page): ResolvedRenderRecord[] {
  const records: ResolvedRenderRecord[] = [];
  const visit = (rawNode: EngineNode, parentId: string | null, inheritedVisible: boolean, inheritedOpacity: number, parentX: number, parentY: number) => {
    const node = expandedNode(document, rawNode);
    const visible = inheritedVisible && node.visible !== false;
    const opacity = inheritedOpacity * (node.opacity ?? 1);
    const transform = node.transform ?? {};
    const x = parentX + (transform.x ?? 0);
    const y = parentY + (transform.y ?? 0);
    const style = resolveObject(node.style, document.tokens) as ResolvedStyle;
    let asset: ResolvedRenderRecord["asset"];
    if (node.assetRef) {
      const ref = document.assets[node.assetRef];
      if (!ref) throw new Error(`Unresolved asset: ${node.assetRef}`);
      asset = { id: node.assetRef, ref };
    }
    records.push({ id: node.id, pageId: page.id, parentId, type: node.type, name: node.name, visible, locked: node.locked === true, opacity, transform: { x, y, rotation: transform.rotation ?? 0, scaleX: transform.scaleX ?? 1, scaleY: transform.scaleY ?? 1 }, style, ...(asset ? { asset } : {}), node });
    if (node.type === "frame") node.children.forEach((child) => visit(child, node.id, visible, opacity, x, y));
  };
  visit(page.root, null, true, 1, 0, 0);
  return records;
}

export function createEngineV3RenderPlan(document: EngineDocumentV3): EngineV3RenderPlan {
  const checked = validateEngineV3Document(document);
  if (!checked.ok) throw new Error(`Invalid Engine v3 document: ${checked.issues[0]?.path} ${checked.issues[0]?.message}`);
  const tokens = Object.fromEntries(Object.entries(checked.document.tokens).map(([category, values]) => [category, Object.fromEntries(Object.entries(values).map(([name, token]) => [name, { ...token, value: resolveValue(`$${name}`, checked.document.tokens, category as keyof TokenSet) }]))])) as TokenSet;
  return { tokens, pages: checked.document.pages.map((page) => ({ id: page.id, name: page.name, width: page.width, height: page.height, background: String(resolveValue(page.background, checked.document.tokens, "colors")), records: pageRecords(checked.document, page) })) };
}
